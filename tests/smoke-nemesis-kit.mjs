// A nemesis should look and fight like its own enemy, not a recoloured trooper.
//
// Before this, a named elite was a TINT AND A SCALE on a stock archetype, and
// every one of them held `wpn-enemy-rifle` and fired the identical bolt. Six
// traits of mechanical variety were real and completely invisible: traits
// changed how LONG an encounter took, never what the player had to do about it.
//
// What is asserted here is the visible half — the marks, the weapon, and the
// shot pattern — plus the three ways this could quietly break something else:
//
//   1. POOL CONTAMINATION. Bullets are recycled. A tinted nemesis bolt handed
//      back to the pool would leave ordinary troopers shooting in the nemesis's
//      colour. (Exactly how pistol bolts once turned into missiles.)
//   2. HITBOX DRIFT. `Bullet.fire` sizes its body with `setCircle(width / 2)`,
//      so per-weapon projectile ART would silently mean per-weapon COLLISION.
//      That is why weapons tint rather than re-texture, and it is asserted
//      rather than trusted.
//   3. ORPHANED SPRITES. Regalia are separate images following the enemy. If
//      they are not swept on death they outlive their owner as floating marks.
//
// And one design rule with teeth: a melee base must never be handed a weapon.
// `grunt` and `swarmling` hide `weaponSprite` entirely, so a rifle on one would
// fire real bullets from an empty hand.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

// `?nodlg=1&nofreeze=1` mutes the dialogue cards. They pause Game and HUD and wait for a
// tap, which hangs a bot for the whole measurement cap — see systems/debug.js.
const URL = 'http://localhost:5173/?nodlg=1&nofreeze=1';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const fail = (m) => { console.error(`FAIL: ${m}`); process.exit(1); };
const checks = [];
const check = (ok, label, detail = '') => { checks.push({ ok, label, detail }); };

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
await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 31337 }));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(1500);

const r = await page.evaluate(async () => {
  const { rollNemesis, REGALIA, REGALIA_ANCHORS, TRAITS } = await import('/src/data/nemesis.js');
  const { NEMESIS_WEAPONS, pickWeapon, baseCanHoldWeapon } = await import('/src/data/nemesisWeapons.js');
  const { makeRng, makeStreams } = await import('/src/systems/rng.js');
  const gs = window.game.scene.getScene('Game');
  const out = {};

  // ── Regalia is derived from traits, not drawn ─────────────────────────
  out.everyTraitHasAMark = TRAITS.every((t) => !!REGALIA[t.id]);
  out.marksArePainted = Object.values(REGALIA).every((k) => gs.textures.exists(k));

  const oneTrait = rollNemesis(1, { traits: ['armored'], base: 'shooter', rng: makeRng(1) });
  const threeTrait = rollNemesis(30, {
    traits: ['armored', 'volatile', 'summoner'], base: 'shooter', rng: makeRng(2),
  });
  out.regalia = {
    one: oneTrait.regalia.slice(),
    three: threeTrait.regalia.slice(),
    anchors: REGALIA_ANCHORS,
    matchesLeadingTraits:
      threeTrait.regalia[0] === REGALIA[threeTrait.traits[0]] &&
      threeTrait.regalia[1] === REGALIA[threeTrait.traits[1]],
  };

  // ── Weapons: seeded, and never on a melee base ────────────────────────
  const kitFor = (seed) => {
    const rng = makeStreams(seed, ['nemesis']).nemesis;
    return rollNemesis(10, { rng });
  };
  out.reproducible = {
    a: JSON.stringify([kitFor(4242).base, kitFor(4242).weapon?.id, kitFor(4242).regalia]),
    b: JSON.stringify([kitFor(4242).base, kitFor(4242).weapon?.id, kitFor(4242).regalia]),
  };

  // Sweep every base against many seeds: a melee base must NEVER get a weapon.
  const meleeArmed = [];
  const rangedUnarmed = [];
  for (const base of ['grunt', 'swarmling', 'shooter', 'bomber', 'shielded', 'sniper']) {
    for (let s = 0; s < 60; s++) {
      const w = pickWeapon(base, makeRng(s));
      if (!baseCanHoldWeapon(base) && w) meleeArmed.push(`${base}:${w.id}`);
      if (baseCanHoldWeapon(base) && !w) rangedUnarmed.push(`${base}@${s}`);
      // And a weapon must only ever land on a base it declares.
      if (w && !w.bases.includes(base)) meleeArmed.push(`${base}!=${w.id}`);
    }
  }
  out.meleeArmed = meleeArmed.slice(0, 5);
  out.rangedUnarmed = rangedUnarmed.slice(0, 5);

  // Every weapon must be reachable from some base, or it is dead config.
  const reachable = new Set();
  for (const base of ['shooter', 'bomber', 'shielded', 'sniper']) {
    for (let s = 0; s < 200; s++) {
      const w = pickWeapon(base, makeRng(s));
      if (w) reachable.add(w.id);
    }
  }
  out.reachable = [...reachable].sort();
  out.allWeapons = NEMESIS_WEAPONS.map((w) => w.id).sort();

  // ── Live: the kit is actually equipped ────────────────────────────────
  gs.arenaActive = false;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  gs.sector = 12;

  const spawnWith = (traits, base, weapon) => {
    const nem = rollNemesis(12, { traits, base, weapon, rng: makeRng(7) });
    return { e: gs._spawnMiniBoss(nem), nem };
  };

  const { e: armedE, nem: armedNem } = spawnWith(['armored', 'volatile'], 'shooter', 'scattergun');
  await new Promise((res) => setTimeout(res, 400));
  out.equipped = {
    weaponId: armedE._nemesisWeapon?.id ?? null,
    weaponTex: armedE.weaponSprite?.texture?.key ?? null,
    expectedTex: armedNem.weapon?.tex ?? null,
    regaliaCount: armedE.regaliaSprites?.length ?? -1,
    attachedForCleanup: (armedE._attachments || []).filter((a) => (armedE.regaliaSprites || []).includes(a)).length,
  };

  // Regalia follows the body.
  armedE.setPosition(700, 700);
  await new Promise((res) => setTimeout(res, 300));
  out.follows = (armedE.regaliaSprites || []).every(
    (s) => Math.hypot(s.x - armedE.x, s.y - armedE.y) < 120);

  // ── Shot patterns: each weapon puts the right thing in the air ────────
  // Fired through a SYNTHETIC shooter, not a live nemesis. A spawned one keeps
  // firing on its own AI during the measurement window, so the counts came back
  // as 15/8/11/8 for volleys of 5/3/1/3 — the weapon was correct and the
  // instrument was counting the enemy's own shots as well. The weapon's `fire`
  // only needs a position, a radius and an alive flag.
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  await new Promise((res) => setTimeout(res, 200));

  const fakeShooter = { x: 700, y: 700, active: true, alive: true, cfg: { radius: 20 } };
  const clearBolts = async () => {
    gs.enemyBullets.getChildren().forEach((b) => b.kill?.());
    await new Promise((res) => setTimeout(res, 150));
  };
  const liveBolts = () => gs.enemyBullets.getChildren().filter((b) => b.active);

  // Count the SHOTS, not the bolts still in the air when the clock runs out.
  // The repeater staggers its three rounds on `delayedCall(i * 90)`, and
  // tests/README.md is explicit that a headless run resolves TimerEvents
  // coarsely — a nominal 70ms delay measures 150-220ms here. So the third round
  // could still be pending at the old flat 500ms, and the check failed on
  // harness timing rather than on the weapon. Wrapping `fire` records every
  // round the instant it is fired, and the wait only has to be generous.
  const fireTest = async (weaponId) => {
    await clearBolts();
    const w = NEMESIS_WEAPONS.find((x) => x.id === weaponId);
    const fired = [];
    const realFire = gs.enemyBullets.fire.bind(gs.enemyBullets);
    gs.enemyBullets.fire = (...args) => {
      const b = realFire(...args);
      // Snapshot on the microtask right after the caller's synchronous
      // `tinted(...)` runs, and never later: waiting 1.4s would read a bolt
      // that had already expired and been cleared back into the pool.
      if (b) Promise.resolve().then(() => fired.push({
        radius: Math.round(b.body?.radius ?? -1), tint: b.tintTopLeft,
      }));
      return b;
    };
    w.fire(gs, fakeShooter, 0);
    await new Promise((res) => setTimeout(res, 1400));  // generous: see above
    gs.enemyBullets.fire = realFire;
    return {
      weaponId,
      spawned: fired.length,
      radii: [...new Set(fired.map((b) => b.radius))],
      tints: [...new Set(fired.map((b) => b.tint))],
    };
  };

  out.scatter = await fireTest('scattergun');
  out.flak = await fireTest('flak');
  out.lance = await fireTest('lance');
  out.repeater = await fireTest('repeater');

  // ── Pool contamination ───────────────────────────────────────────────
  // Fire a tinted volley, return it to the pool, then fire an ORDINARY bolt
  // through the same group and check it did not inherit the colour. Also
  // isolated from live AI — with enemies on the field this measured other
  // people's bullets.
  await clearBolts();
  NEMESIS_WEAPONS.find((w) => w.id === 'scattergun').fire(gs, fakeShooter, 0);
  await new Promise((res) => setTimeout(res, 200));
  const tintedCount = liveBolts().length;
  await clearBolts();                       // back to the pool, still tinted
  gs.enemyBullets.fire(700, 700, 0, 300, 10, 400, { owner: 'enemy' });
  await new Promise((res) => setTimeout(res, 200));
  const plainBolts = liveBolts();
  out.contamination = {
    tintedCount,
    plainTints: [...new Set(plainBolts.map((b) => b.tintTopLeft))],
    plainIsTinted: plainBolts.some((b) => b.isTinted),
    count: plainBolts.length,
  };
  await clearBolts();

  // ── Orphans ──────────────────────────────────────────────────────────
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  await new Promise((res) => setTimeout(res, 200));
  const before = gs.children.list.length;
  const doomed = gs._spawnMiniBoss(rollNemesis(12, { traits: ['summoner', 'colossal'], base: 'shooter', rng: makeRng(13) }));
  await new Promise((res) => setTimeout(res, 300));
  const marks = (doomed.regaliaSprites || []).slice();
  gs._destroyEnemyFully(doomed);
  await new Promise((res) => setTimeout(res, 300));
  out.orphans = {
    marksSpawned: marks.length,
    stillAlive: marks.filter((m) => m.active).length,
    inDisplayList: marks.filter((m) => gs.children.list.includes(m)).length,
    netChildren: gs.children.list.length - before,
  };

  return out;
});

await browser.close();

// ── Regalia ──────────────────────────────────────────────────────────────
check(r.everyTraitHasAMark, 'every trait has a mark', 'a trait with no mark is invisible again');
check(r.marksArePainted, 'and every mark is actually painted into the atlas', '');
check(r.regalia.one.length === 1, 'a one-trait nemesis wears one mark', `${r.regalia.one.length}`);
check(r.regalia.three.length === r.regalia.anchors,
  `a three-trait nemesis wears ${r.regalia.anchors}, not three`,
  `${r.regalia.three.length} marks — a third overlaps the others on a 20px body and turns a readable silhouette into noise`);
check(r.regalia.matchesLeadingTraits, 'and they are its leading traits, so the silhouette does not lie', '');

// ── Weapons ──────────────────────────────────────────────────────────────
check(r.reproducible.a === r.reproducible.b, 'the whole kit is reproducible from a seed',
  'weapon choice consumes a draw, so an unseeded pick would break replay');
check(r.meleeArmed.length === 0,
  'a melee base is NEVER handed a weapon, and no weapon lands on a base it did not declare',
  `offenders: ${r.meleeArmed.join(', ')} — grunts hide weaponSprite, so this fires invisible bullets`);
check(r.rangedUnarmed.length === 0, 'and every ranged base always gets one',
  `unarmed: ${r.rangedUnarmed.join(', ')}`);
check(r.reachable.join() === r.allWeapons.join(), 'every weapon is reachable in play',
  `reachable ${r.reachable.join(',')} of ${r.allWeapons.join(',')} — an unreachable one is dead config`);

// ── Equipped ─────────────────────────────────────────────────────────────
check(r.equipped.weaponId === 'scattergun', 'the nemesis carries its weapon', `got ${r.equipped.weaponId}`);
check(r.equipped.weaponTex === r.equipped.expectedTex,
  'and is visibly holding it, not the stock rifle',
  `${r.equipped.weaponTex} vs ${r.equipped.expectedTex}`);
check(r.equipped.regaliaCount === 2, 'wearing both its marks', `${r.equipped.regaliaCount}`);
check(r.equipped.attachedForCleanup === r.equipped.regaliaCount,
  'each registered for teardown', `${r.equipped.attachedForCleanup} of ${r.equipped.regaliaCount}`);
check(r.follows, 'the marks follow the body', '');

// ── Patterns ─────────────────────────────────────────────────────────────
check(r.scatter.spawned === 5, 'SCATTERGUN throws a 5-pellet cone', `${r.scatter.spawned} bolts`);
check(r.flak.spawned === 3, 'FLAK LAUNCHER throws a 3-shell spread', `${r.flak.spawned} bolts`);
check(r.lance.spawned === 1, 'BEAM LANCE fires a single shot', `${r.lance.spawned} bolts`);
check(r.repeater.spawned === 3, 'TWIN REPEATERS burst three rounds', `${r.repeater.spawned} bolts`);
const tintsDiffer = new Set([r.scatter.tints[0], r.flak.tints[0], r.lance.tints[0], r.repeater.tints[0]]).size === 4;
check(tintsDiffer, 'and each weapon reads as its own colour',
  `${[r.scatter, r.flak, r.lance, r.repeater].map((w) => `${w.weaponId}:${w.tints[0]}`).join(' ')}`);

// ── Hitbox parity: the reason they tint instead of re-texturing ──────────
const allRadii = [...new Set([...r.scatter.radii, ...r.flak.radii, ...r.lance.radii, ...r.repeater.radii])];
check(allRadii.length === 1 && allRadii[0] > 0,
  'every weapon fires a bolt with an IDENTICAL hitbox',
  `radii ${allRadii.join(', ')} — per-weapon bullet art would size the body with it and change balance silently`);

// ── Pool contamination ───────────────────────────────────────────────────
check(r.contamination.tintedCount > 0, 'a tinted volley really was fired first (the control)',
  `${r.contamination.tintedCount} bolts — without this the next check passes on an empty pool`);
check(r.contamination.count > 0 && !r.contamination.plainIsTinted,
  'and an ordinary bolt fired after a tinted volley is NOT tinted',
  `tints ${r.contamination.plainTints.join(',')} across ${r.contamination.count} bolts — recycled bullets keep their last tint`);

// ── Orphans ──────────────────────────────────────────────────────────────
check(r.orphans.marksSpawned === 2, 'a dying nemesis had marks to clean up', `${r.orphans.marksSpawned}`);
check(r.orphans.stillAlive === 0 && r.orphans.inDisplayList === 0,
  'and they die with it rather than floating in an empty room',
  `${r.orphans.stillAlive} active, ${r.orphans.inDisplayList} still in the display list`);
check(r.orphans.netChildren <= 0, 'leaving no net objects behind', `${r.orphans.netChildren}`);

for (const c of checks) {
  console.log(`  ${c.ok ? 'ok  ' : 'FAIL'}  ${c.label}${c.ok || !c.detail ? '' : ' — ' + c.detail}`);
}
const failed = checks.filter((c) => !c.ok);
if (failed.length) fail(`${failed.length} of ${checks.length} checks failed: ${failed.map((f) => f.label).join('; ')}`);
console.log(`PASS: ${checks.length} checks — a nemesis looks and fights like its own enemy`);
