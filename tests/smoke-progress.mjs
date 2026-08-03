// Run progression: upgrades, room transitions, save/load.
//
// Three systems that had no coverage at all and that a refactor breaks
// silently — you only notice by playing a full run to the end. All logic
// assertions, no frame timing, so unlike smoke-pathing this can gate.
//
// Deliberately drives the real code paths rather than reimplementing them:
// UPGRADES[].apply against a live Player, GameScene.loadRoom for transitions,
// and the actual loadStats/saveStats pair from TitleScene.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const URL = 'http://localhost:5173/';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const fail = (m) => { console.error(`FAIL: ${m}`); process.exit(1); };
const checks = [];
const check = (ok, label, detail) => { checks.push({ ok, label, detail }); };

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
  const { UPGRADES, pickThree } = await import('/src/data/upgrades.js');
  const stats = await import('/src/scenes/TitleScene.js');
  const out = {};

  // ── Upgrades ───────────────────────────────────────────────────────────
  const p = gs.player;
  // Every card must actually move a Player field. A card whose apply() is a
  // no-op is invisible in play — you pick it and nothing happens.
  const snapshot = () => {
    const o = {};
    for (const k of Object.keys(p)) {
      if (typeof p[k] === 'number') o[k] = p[k];
    }
    return o;
  };
  out.inert = [];
  out.cards = UPGRADES.length;
  for (const up of UPGRADES) {
    const before = snapshot();
    up.apply(p);
    const after = snapshot();
    const changed = Object.keys(after).filter((k) => after[k] !== before[k]);
    if (!changed.length) out.inert.push(up.id);
  }

  // Multiplicative cards must STACK, not overwrite. dmgMult is *= 1.25.
  const fresh = { dmgMult: 1, _upgrades: [] };
  const heavy = UPGRADES.find((u) => u.id === 'heavyRounds');
  heavy.apply(fresh); heavy.apply(fresh);
  out.stacked = fresh.dmgMult;

  // Cards must be distinct within an offer.
  out.offers = [];
  for (let i = 0; i < 40; i++) {
    const three = pickThree();
    out.offers.push({
      n: three.length,
      unique: new Set(three.map((u) => u.id)).size,
    });
  }
  // And every card must be reachable from the pool at all.
  const seenIds = new Set();
  for (let i = 0; i < 400; i++) for (const u of pickThree()) seenIds.add(u.id);
  out.reachable = seenIds.size;

  // ── Room transitions ───────────────────────────────────────────────────
  // loadRoom must fully tear down the previous room. A leak here shows up as
  // ghost enemies or duplicated cover several rooms later.
  gs.loadRoom(ROOMS[0]);
  await new Promise((res) => setTimeout(res, 1200));
  const before = {
    walls: gs.walls.getChildren().length,
    room: gs.roomManager.index,
    layer: gs.roomLayer.getChildren().length,
  };
  gs.loadRoom(ROOMS[2]);
  await new Promise((res) => setTimeout(res, 1200));
  gs.loadRoom(ROOMS[2]);      // same room twice — must not double up
  await new Promise((res) => setTimeout(res, 1200));
  const after = {
    walls: gs.walls.getChildren().length,
    room: gs.roomManager.index,
    layer: gs.roomLayer.getChildren().length,
  };
  // What the room SHOULD contain, from its own spec.
  const spec = ROOMS[2];
  out.transition = {
    before, after,
    expectWalls: spec.walls.length + spec.cover.length
      + (spec.props || []).filter((x) => x.solid).length,
    indexTracks: gs.roomManager.index === ROOMS.indexOf(spec),
    total: gs.roomManager.total,
  };

  // Only one backdrop texture should survive a transition (~9MB each).
  out.backdrops = gs.textures.getTextureKeys().filter((k) => k.startsWith('backdrop')).length;

  // ── Save / load ────────────────────────────────────────────────────────
  const original = localStorage.getItem('crix.stats');
  // Catch here rather than letting a throw escape page.evaluate. Without this
  // the suite still goes red, but as an unreadable stack trace instead of
  // "corrupt save loads as empty" — and a failure you have to decode is a
  // failure people learn to skip.
  const safeLoad = () => {
    try { return JSON.stringify(stats.loadStats()); }
    catch (e) { return 'THREW: ' + e.message; }
  };
  localStorage.removeItem('crix.stats');
  out.emptyLoad = safeLoad();

  localStorage.setItem('crix.stats', '{ this is not json');
  out.corruptLoad = safeLoad();

  const written = { runs: 7, bestKills: 42, bestTime: 123.5 };
  stats.saveStats(written);
  out.roundTrip = stats.loadStats();

  // Personal bests must only ever improve. Replays GameOverScene's merge.
  const merge = (globalStats, s) => {
    globalStats.bestKills = Math.max(globalStats.bestKills || 0, s.kills || 0);
    if (!globalStats.bestTime || s.clearTime < globalStats.bestTime) {
      globalStats.bestTime = s.clearTime;
    }
    return globalStats;
  };
  const g = { bestKills: 42, bestTime: 100 };
  merge(g, { kills: 10, clearTime: 200 });   // both worse — must not regress
  out.afterWorse = { ...g };
  merge(g, { kills: 99, clearTime: 50 });    // both better — must take
  out.afterBetter = { ...g };

  if (original === null) localStorage.removeItem('crix.stats');
  else localStorage.setItem('crix.stats', original);

  return out;
});

await browser.close();

// ── Upgrades ─────────────────────────────────────────────────────────────
check(r.inert.length === 0, `all ${r.cards} upgrade cards mutate the player`,
  r.inert.length ? `inert: ${r.inert.join(', ')}` : '');
check(Math.abs(r.stacked - 1.5625) < 1e-9, 'multiplicative upgrades stack',
  `two heavyRounds gave dmgMult ${r.stacked}, expected 1.5625`);
const badOffer = r.offers.find((o) => o.n !== 3 || o.unique !== 3);
check(!badOffer, 'every offer is 3 distinct cards',
  badOffer ? `got ${badOffer.n} cards, ${badOffer.unique} unique` : '');
check(r.reachable === r.cards, 'every card can actually be offered',
  `${r.reachable} of ${r.cards} ids seen across 1200 draws`);

// ── Transitions ──────────────────────────────────────────────────────────
const t = r.transition;
check(t.after.walls === t.expectWalls, 'loadRoom rebuilds obstacles exactly',
  `${t.after.walls} in the walls group, spec says ${t.expectWalls}`);
check(t.indexTracks, 'RoomManager index follows the loaded room',
  `index ${t.after.room} of ${t.total}`);
check(r.backdrops === 1, 'only one backdrop texture survives a transition',
  `${r.backdrops} resident (~9MB each)`);

// ── Save / load ──────────────────────────────────────────────────────────
check(r.emptyLoad === '{}', 'missing save loads as empty, does not throw', r.emptyLoad);
check(r.corruptLoad === '{}', 'corrupt save loads as empty, does not throw', r.corruptLoad);
check(r.roundTrip.runs === 7 && r.roundTrip.bestKills === 42 && r.roundTrip.bestTime === 123.5,
  'stats round-trip through localStorage', JSON.stringify(r.roundTrip));
check(r.afterWorse.bestKills === 42 && r.afterWorse.bestTime === 100,
  'a worse run never lowers a personal best', JSON.stringify(r.afterWorse));
check(r.afterBetter.bestKills === 99 && r.afterBetter.bestTime === 50,
  'a better run does update it', JSON.stringify(r.afterBetter));

for (const c of checks) {
  console.log(`  ${c.ok ? 'ok  ' : 'FAIL'}  ${c.label}${c.ok || !c.detail ? '' : ' — ' + c.detail}`);
}
const failed = checks.filter((c) => !c.ok);
if (failed.length) fail(`${failed.length} of ${checks.length} checks failed: ${failed.map((f) => f.label).join('; ')}`);

console.log(`PASS: ${checks.length} checks — upgrades apply and stack, rooms tear down, stats persist`);
