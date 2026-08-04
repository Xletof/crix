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
  // Apply each card to a FRESH baseline, not cumulatively to one player.
  // Applying in sequence hides base-case duds: a card that does nothing on a
  // starting build can still register a change against a player that earlier
  // cards already modified. LAST RESORT was exactly that — inert at 1000 hpMax,
  // but invisible here until the snapshot was taken per card.
  const baseline = () => {
    const o = {};
    for (const k of Object.keys(p)) if (typeof p[k] === 'number') o[k] = p[k];
    o.dmgMult = 1; o.reloadMult = 1; o.moveMult = 1; o.regenMult = 1;
    o.superGainMult = 1; o.dashRechargeMult = 1; o.dashChargesBonus = 0;
    o.killHeal = 0; o.hpMax = 1000; o.hp = 1000; o._upgrades = [];
    return o;
  };
  for (const up of UPGRADES) {
    const q = baseline();
    const before = { ...q };
    up.apply(q);
    const changed = Object.keys(before).filter((k) => q[k] !== before[k]);
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

  // A card already taken must never be offered again.
  const taken = UPGRADES.slice(0, 4).map((u) => u.id);
  out.repeats = 0;
  for (let i = 0; i < 300; i++) {
    for (const u of pickThree(taken)) if (taken.includes(u.id)) out.repeats++;
  }
  // ...unless filtering would leave too few to fill an offer, in which case a
  // full offer beats a correct-but-empty one.
  const nearlyAll = UPGRADES.slice(0, UPGRADES.length - 1).map((u) => u.id);
  out.exhausted = pickThree(nearlyAll).length;

  // Trade-off cards must cost something, not just give. Each is checked for
  // the downside as well as the upside — a trade-off whose cost silently
  // stopped applying would read as a plain buff and quietly unbalance the run.
  const mk = () => ({ dmgMult: 1, moveMult: 1, reloadMult: 1, hpMax: 1000, hp: 1000,
                      dashChargesBonus: 0, _upgrades: [] });
  const byId = (id) => UPGRADES.find((u) => u.id === id);
  out.tradeoffs = {};
  for (const id of ['glassCannon', 'siegeStance', 'lightweightRig', 'hairTrigger']) {
    const card = byId(id);
    if (!card) { out.tradeoffs[id] = 'MISSING'; continue; }
    const q = mk(); card.apply(q);
    out.tradeoffs[id] = {
      up: q.dmgMult > 1 || q.moveMult > 1 || q.reloadMult < 1 || q.dashChargesBonus > 0,
      down: q.hpMax < 1000 || q.moveMult < 1 || q.dmgMult < 1,
      hpValid: q.hp > 0 && q.hp <= q.hpMax,
    };
  }

  // Synergy cards must actually read the build.
  const momentum = byId('momentum');
  const solo = mk(); momentum.apply(solo);
  const stacked3 = mk(); stacked3._upgrades = ['a', 'b', 'c']; momentum.apply(stacked3);
  out.synergy = { solo: solo.dmgMult, withThree: stacked3.dmgMult };

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
    // Compare by ID, not by index or object identity. RoomManager has its own
    // `import { ROOMS }`, and under the Vite dev server a module edited since
    // the page loaded is served again with a cache-busting query — so this
    // test's `/src/data/rooms.js` and the app's can be two DIFFERENT module
    // instances. Then `ROOMS.indexOf(spec)` is -1 and `roomManager.index` is
    // -1 for a room that loaded perfectly. That is a dev-server artifact with
    // no production equivalent (one bundle, one instance), and it made this
    // check fail on every run after any edit to rooms.js. Reading the
    // manager's OWN view of the room never crosses the boundary.
    indexTracks: gs.roomManager.current?.id === spec.id,
    total: gs.roomManager.total,
  };

  // Only one backdrop texture should survive a transition (~9MB each).
  out.backdrops = gs.textures.getTextureKeys().filter((k) => k.startsWith('backdrop')).length;

  // ── Weapon choice ──────────────────────────────────────────────────────
  // Both secondaries drop and taking one must retire the other. This replaced
  // a Phaser.Math.Between coin flip, so the thing worth guarding is that a
  // choice is actually offered and that it costs you the alternative.
  gs.loadRoom(ROOMS[0]);
  await new Promise((res) => setTimeout(res, 1200));
  gs.player.setPosition(800, 700);
  gs.spawnWeaponChoice(800, 700, 'REWARD');
  await new Promise((res) => setTimeout(res, 500));
  const pair = gs._pendingChoice ? gs._pendingChoice.offered : [];
  out.choice = {
    n: pair.length,
    ids: pair.map((w) => w.weaponId),
    // Must exceed WeaponPickup's 90px magnet or one walk grabs both.
    gap: pair.length === 2 ? Math.round(Math.abs(pair[0].x - pair[1].x)) : 0,
  };
  if (pair.length === 2) {
    const target = pair[0];
    for (let i = 0; i < 60 && target.active; i++) {
      gs.player.setPosition(target.x, target.y);
      await new Promise((res) => setTimeout(res, 40));
    }
    await new Promise((res) => setTimeout(res, 300));
    out.choice.took = target.weaponId;
    out.choice.siblingRetired = !pair[1].active;
    out.choice.pendingCleared = gs._pendingChoice === null;
  }

  // ── BLOOD PACT actually pays out on a kill ─────────────────────────────
  // The gap this closes: every other upgrade check here verifies apply()
  // mutates a field. That is necessary and not sufficient. BLOOD PACT set its
  // field correctly and still read as broken in play, because at full health
  // the heal clamped to hpMax and produced nothing — and regen puts you at
  // full health most of the time. A card has to be checked for its EFFECT,
  // not just its assignment.
  gs.loadRoom(ROOMS[0]);
  await new Promise((res) => setTimeout(res, 1200));
  const pl = gs.player;
  pl.killHeal = 0;
  byId('killHeal').apply(pl);
  let hpChanged = 0;
  const countHp = () => hpChanged++;
  gs.events.on('player-hp-changed', countHp);
  const killOne = async () => {
    const v = gs.enemies.getChildren().find((e) => e.alive);
    if (!v) return false;
    v.damage(99999);
    await new Promise((res) => setTimeout(res, 350));
    return true;
  };

  pl.hp = Math.round(pl.hpMax * 0.4); pl.shieldHp = 0;
  const hurtBefore = pl.hp;
  const hurtKilled = await killOne();
  out.pactHurt = { killed: hurtKilled, gained: Math.round(pl.hp - hurtBefore) };

  // At full health it must still pay out, as shield.
  pl.hp = pl.hpMax; pl.shieldHp = 0;
  const fullKilled = await killOne();
  out.pactFull = { killed: fullKilled, hpOverflowed: pl.hp > pl.hpMax,
                   shield: Math.round(pl.shieldHp) };
  gs.events.off('player-hp-changed', countHp);
  out.pactHpEvents = hpChanged;
  pl.killHeal = 0;

  // ── Perimeter dressing ─────────────────────────────────────────────────
  // The wall band is painted into the backdrop canvas, so it carries no
  // collision and cannot regress pathing. What it CAN do is get painted across
  // a spawn gate, and then enemies surge in through a solid-looking wall. The
  // openings are derived from the spec for that reason, and this is the check
  // that the derivation still lines up with where the gates actually are.
  {
    const { perimeterOpenings } = await import('/src/data/mapUtils.js');
    const { paintBackdrop } = await import('/src/systems/pixelArt.js');
    out.perim = [];

    for (const spec of ROOMS) {
      const { w, h } = spec.bounds;
      const openings = perimeterOpenings(spec);
      const rec = { id: spec.id, styled: !!spec.perimeter, unserved: [], count: openings.length,
                    expect: (spec.gates?.length || 0) + (spec.exit ? 1 : 0) };

      for (const g of spec.gates || []) {
        const distTo = { top: g.y, bottom: h - g.y, left: g.x, right: w - g.x };
        const side = Object.keys(distTo).sort((a, b) => distTo[a] - distTo[b])[0];
        const along = (side === 'left' || side === 'right') ? g.y : g.x;
        // Exactly one: zero means the wall is painted over the gate, two means
        // a corner gate punched a hole in both of its edges.
        const cover = openings.filter((o) => o.side === side && Math.abs(o.at - along) <= o.width / 2);
        if (cover.length !== 1) rec.unserved.push(`(${g.x},${g.y}) ${side}:${cover.length}`);
      }

      // And prove it in pixels, not just in the data: paint the room's backdrop
      // to a scratch key and confirm the doorway is actually darker than the
      // wall beside it. Averaged over several samples because the scorch pass
      // drops 40-70 dark blobs on top and a single probe can land in one.
      if (spec.perimeter) {
        const key = `__perimtest-${spec.id}`;
        if (gs.textures.exists(key)) gs.textures.remove(key);
        paintBackdrop(gs, key, w, h, { ...(spec.floor || {}), perimeter: spec.perimeter, openings });
        const ctx = gs.textures.get(key).getContext();
        const th = spec.perimeter.thickness ?? 64;
        const mid = Math.round(th / 2);
        // Sample the edge the first opening is on, whichever that is — pinning
        // this to the top edge would silently skip the pixel check for any
        // future room without a top gate, and a check that can vanish is worse
        // than no check.
        const door = openings[0];
        const len = (door.side === 'left' || door.side === 'right') ? h : w;
        const px = {                       // (along the edge) -> canvas x,y
          top:    (a) => [a, mid],
          bottom: (a) => [a, h - mid],
          left:   (a) => [mid, a],
          right:  (a) => [w - mid, a],
        }[door.side];
        const lum = (a) => { const [x, y] = px(a); const d = ctx.getImageData(x, y, 1, 1).data; return (d[0] + d[1] + d[2]) / 3; };
        const mean = (as) => as.reduce((s, a) => s + lum(a), 0) / as.length;

        const sameEdge = openings.filter((o) => o.side === door.side);
        const clear = [];
        for (let a = th + 40; a < len - th - 40 && clear.length < 9; a += 37) {
          if (sameEdge.every((o) => Math.abs(a - o.at) > o.width / 2 + 30)) clear.push(a);
        }
        rec.edge = door.side;
        rec.wallLum = +mean(clear).toFixed(1);
        rec.doorLum = +mean([-50, -25, 0, 25, 50].map((d) => door.at + d)).toFixed(1);
        gs.textures.remove(key);
      }
      out.perim.push(rec);
    }
  }

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
check(r.repeats === 0, 'a card already taken is never offered again',
  `${r.repeats} repeats across 900 draws`);
check(r.exhausted === 3, 'a near-exhausted pool still fills the offer',
  `got ${r.exhausted} cards`);
for (const [id, t] of Object.entries(r.tradeoffs)) {
  check(t !== 'MISSING' && t.up && t.down && t.hpValid, `${id} both gives and costs`,
    t === 'MISSING' ? 'card not found' : `up=${t.up} down=${t.down} hpValid=${t.hpValid}`);
}
check(r.synergy.withThree > r.synergy.solo, 'synergy cards read the existing build',
  `momentum gave ${r.synergy.solo} alone vs ${r.synergy.withThree} with 3 upgrades`);

// ── Transitions ──────────────────────────────────────────────────────────
const t = r.transition;
check(t.after.walls === t.expectWalls, 'loadRoom rebuilds obstacles exactly',
  `${t.after.walls} in the walls group, spec says ${t.expectWalls}`);
check(t.indexTracks, 'RoomManager index follows the loaded room',
  `manager says index ${t.after.room} of ${t.total}`);
check(r.backdrops === 1, 'only one backdrop texture survives a transition',
  `${r.backdrops} resident (~9MB each)`);

// ── Weapon choice ────────────────────────────────────────────────────────
const c = r.choice;
check(c.n === 2 && c.ids.includes('rifle') && c.ids.includes('cluster'),
  'a weapon reward offers both secondaries', `got [${c.ids.join(', ')}]`);
check(c.gap > 200, 'the two drops are spaced beyond the 90px pickup magnet',
  `${c.gap}px apart`);
check(c.siblingRetired === true, 'taking one weapon retires the other',
  `took ${c.took}, sibling still active`);
check(c.pendingCleared === true, 'the pending choice is cleared after resolving', '');

// ── BLOOD PACT ───────────────────────────────────────────────────────────
check(r.pactHurt.killed && r.pactHurt.gained > 0, 'BLOOD PACT heals on a kill when hurt',
  `gained ${r.pactHurt.gained} HP`);
check(r.pactFull.killed && r.pactFull.shield > 0, 'BLOOD PACT banks shield at full health',
  `shield ${r.pactFull.shield} (this case used to do nothing at all)`);
check(!r.pactFull.hpOverflowed, 'the heal never pushes HP past max', '');
check(r.pactHpEvents > 0, 'the heal emits player-hp-changed so the HUD refreshes',
  `${r.pactHpEvents} events (it emitted player-heal, which nothing listens to)`);

// ── Perimeter dressing ───────────────────────────────────────────────────
for (const p of r.perim) {
  check(p.styled, `${p.id} has a perimeter style`, 'no `perimeter` block on the spec');
  check(p.unserved.length === 0, `${p.id}: every spawn gate has a doorway in the wall`,
    p.unserved.length ? p.unserved.join(', ') : '');
  check(p.count === p.expect, `${p.id}: one opening per gate plus the exit`,
    `${p.count} openings, expected ${p.expect}`);
  check(p.doorLum !== undefined && p.doorLum < p.wallLum * 0.6,
    `${p.id}: the doorway is cut, not painted over`,
    `${p.edge} edge: doorway luminance ${p.doorLum} vs wall ${p.wallLum}`);
}

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
