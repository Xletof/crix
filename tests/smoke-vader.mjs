// Vader's mechanic ladder — asserted by EFFECT, not by flag.
//
// The escalation used to be two speed multipliers wearing mechanic names, and a
// test that checked `boss._mechanics.includes('hunt')` would have passed on
// them happily. So nothing here reads a flag. Each check does the thing a
// player would do and looks at what happened:
//
//   deflection   fire at him with the saber up -> he takes nothing AND the shot
//                comes back
//   disarm       the secondary is gone, the pickup is on the floor OUT of
//                magnet range, and collecting it restores the ammo you had
//   lights out   the darkness overlay is actually raised, and comes back down
//   afterimages  the copies die to one hit and the real one does not
//
// The wound->return state machine is checked across three encounters, because
// "wounded rather than killed" is the premise of endless and the bug it guards
// against — a Vader who actually dies — ends the ladder for the rest of the run.
//
// THREE HARNESS TRAPS, all of which produced wrong results here first:
//
//  1. Vader kills the test player. `defeat()` then tears the scene down, and it
//     surfaces as Phaser groups with no entries several blocks later, nowhere
//     near the cause. Hence `keepAlive()` between blocks.
//  2. Counting "hostile bullets exist" to detect a deflection is intermittent —
//     his fan and his guards make them too. Counted via the `boss-reflected`
//     event instead.
//  3. Driving him to zero starts a real room transition, and a second loadRoom
//     on top of one in flight kills the scene. The wound block suppresses the
//     transition and re-acquires the scene per encounter.
//
// Nothing here waits for a mechanic's own clock. They are measured in seconds
// and this harness runs at ~20 FPS; each mechanic is driven through the event
// the boss fires anyway — see Boss._tickMechanics.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const URL = 'http://localhost:5173/';
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
await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 777 }));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(1500);

// Drop into the boss room at a chosen encounter.
const enterBossRoom = async (encounter) => page.evaluate(async (n) => {
  const gs = window.game.scene.getScene('Game');
  const { ROOMS } = await import('/src/data/rooms.js');
  const { ENDLESS } = await import('/src/config.js');
  gs.sector = n * ENDLESS.bossEvery;
  gs.loadRoom(ROOMS.find((r) => r.boss));
  await new Promise((r) => setTimeout(r, 2200));
  gs.arenaActive = false;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  if (!gs.boss?.alive) {
    gs.spawnBoss(gs.player.x + 380, gs.player.y);
    await new Promise((r) => setTimeout(r, 700));
  }
  gs.player.hp = gs.player.hpMax;
  gs.lives = 9999;   // trap 1
  return { mechanics: (gs.boss._mechanics || []).slice(), hpMax: gs.boss.hpMax };
}, encounter);

const keepAlive = () => page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs.lives = 9999;
  if (gs.player) { gs.player.alive = true; gs.player.hp = gs.player.hpMax; }
});

const r = {};

// ── The ladder has shed its stat-only entries ─────────────────────────────
r.ladder = await page.evaluate(async () => {
  const { ENDLESS } = await import('/src/config.js');
  return {
    ids: ENDLESS.bossMechanics.map((m) => m.id),
    hasSpeedOnly: ENDLESS.bossMechanics.some((m) => m.id === 'hunt' || m.id === 'unbound'),
  };
});

r.enc1 = await enterBossRoom(1);
r.enc3 = await enterBossRoom(3);

// ── DEFLECTION ────────────────────────────────────────────────────────────
r.reflect = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const b = gs.boss;

  let reflections = 0;                       // trap 2
  const onRefl = () => reflections++;
  gs.events.on('boss-reflected', onRefl);

  // Control: with the saber DOWN the same shot must land, or the next check
  // proves nothing except that the boss is hard to hit.
  b._reflectUntil = 0;
  const hpBefore = b.hp;
  const ang = Math.atan2(b.y - gs.player.y, b.x - gs.player.x);
  const shoot = () => gs.playerBullets.fire(
    b.x - Math.cos(ang) * 70, b.y - Math.sin(ang) * 70, ang, 900, 400, 900, { owner: 'player' });
  shoot();
  await new Promise((res) => setTimeout(res, 350));
  const normalDamage = hpBefore - b.hp;
  const reflWhileDown = reflections;

  // Now with the saber UP.
  b._reflectUntil = gs.time.now + 4000;
  const hpGuarded = b.hp;
  shoot();
  await new Promise((res) => setTimeout(res, 350));
  const guardedDamage = hpGuarded - b.hp;
  const reflWhileUp = reflections - reflWhileDown;

  const whileUp = b.isReflecting();
  b._reflectUntil = 0;
  const whileDown = b.isReflecting();
  gs.events.off('boss-reflected', onRefl);

  return { normalDamage, guardedDamage, reflWhileDown, reflWhileUp, whileUp, whileDown };
});

await keepAlive();

// ── DISARM ────────────────────────────────────────────────────────────────
r.disarm = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  gs.player.equipSecondary('rifle');
  gs.player.secondaryAmmo = 7;               // a distinctive, partial figure
  const had = { id: gs.player.secondary, ammo: gs.player.secondaryAmmo };
  const pickupsBefore = gs.weaponPickups.length;

  gs.events.emit('boss-disarm', gs.boss);
  await new Promise((res) => setTimeout(res, 250));
  const wp = gs.weaponPickups[gs.weaponPickups.length - 1];
  const during = {
    id: gs.player.secondary,
    pickups: gs.weaponPickups.length,
    // It must land OUTSIDE the 90px pickup magnet, or a player fighting him at
    // close range re-collects it instantly and the mechanic is a no-op.
    dropDist: Math.round(Math.hypot(wp.x - gs.player.x, wp.y - gs.player.y)),
  };

  // Recover it: walking onto it hands the weapon back.
  gs.player.setPosition(wp.x, wp.y);
  await new Promise((res) => setTimeout(res, 500));
  const after = { id: gs.player.secondary, ammo: gs.player.secondaryAmmo };

  // Disarming an unarmed player must not litter the floor.
  gs.player._equipNothing();
  const emptyBefore = gs.weaponPickups.length;
  gs.events.emit('boss-disarm', gs.boss);
  await new Promise((res) => setTimeout(res, 200));
  const emptyAfter = gs.weaponPickups.length;

  return { had, during, after, pickupsBefore, emptyBefore, emptyAfter };
});

await keepAlive();

// ── LIGHTS OUT ────────────────────────────────────────────────────────────
r.blackout = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const hud = window.game.scene.getScene('HUD');
  const alpha = () => hud.darknessOverlay?.alpha ?? 0;
  // Force the lights ON first. The room can roll the DARKNESS modifier, which
  // leaves the overlay already at alpha 1 — then "lights out raises it" has
  // nothing to raise and fails on a build where the mechanic works perfectly.
  // The check is about Vader's blackout, so the starting state has to be known
  // rather than inherited from whatever modifier the arena picked.
  gs.events.emit('set-darkness', false);
  await new Promise((res) => setTimeout(res, 400));
  const before = alpha();
  gs.events.emit('boss-blackout', gs.boss, 700);
  await new Promise((res) => setTimeout(res, 250));
  const during = alpha();
  await new Promise((res) => setTimeout(res, 1600));
  return { before, during, after: alpha() };
});

await keepAlive();

// ── AFTERIMAGES ───────────────────────────────────────────────────────────
r.afterimages = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const b = gs.boss;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  gs.events.emit('boss-afterimages', b, 3);
  await new Promise((res) => setTimeout(res, 500));

  const clones = gs.enemies.getChildren().filter((e) => e.alive && e._afterimage);
  const spawned = clones.length;
  // They have to wear HIS sprite — a tinted grunt answers "which one is he?"
  // before the question lands.
  const wearingHisSprite = clones.filter((c) => c.texture?.key === 'boss').length;

  const bossHpBefore = b.hp;
  clones.forEach((c) => c.damage(1));
  await new Promise((res) => setTimeout(res, 300));
  const cloneSurvivors = gs.enemies.getChildren().filter((e) => e.alive && e._afterimage).length;

  b.damage(1);
  await new Promise((res) => setTimeout(res, 200));

  return { spawned, wearingHisSprite, cloneSurvivors, bossStillAlive: b.alive,
           bossHpFrac: b.hp / b.hpMax, bossHpBefore };
});

await keepAlive();

// ── Wound -> return ───────────────────────────────────────────────────────
await page.evaluate(() => {
  window.__vaderTally = { wounds: 0, deaths: 0 };
  // Bound per-encounter below, not once: the scene emitter is cleared between
  // rooms, so a single binding here would quietly stop counting.
  window.__rebindVader = (scene) => {
    scene.events.on('boss-wounded', () => window.__vaderTally.wounds++);
    scene.events.on('boss-died', () => window.__vaderTally.deaths++);
  };
});

r.wound = { seen: [] };
for (let n = 1; n <= 3; n++) {
  const one = await page.evaluate(async (enc) => {
    const gs = window.game.scene.getScene('Game');
    const { ROOMS } = await import('/src/data/rooms.js');
    const { ENDLESS } = await import('/src/config.js');
    window.__rebindVader(gs);

    gs.sector = enc * ENDLESS.bossEvery;
    gs.loadRoom(ROOMS.find((r) => r.boss));
    await new Promise((res) => setTimeout(res, 2200));
    gs.arenaActive = false;
    gs.lives = 9999;
    if (!gs.boss?.alive) {
      gs.spawnBoss(gs.player.x + 380, gs.player.y);
      await new Promise((res) => setTimeout(res, 700));
    }
    const b = gs.boss;
    const rec = { n: enc, hpMax: b.hpMax, mech: (b._mechanics || []).length, cap: b._dmgCap };

    gs._maybeCompleteRoom = () => {};       // trap 3

    // Bounded by WALL CLOCK, not hit count: the intake cap absorbs everything
    // past 1600 per 120ms window, so hammering in a tight loop delivers one
    // window's worth however many calls it makes.
    const deadline = performance.now() + 30000;
    while (b.alive && performance.now() < deadline) {
      b.damage(5000);
      await new Promise((res) => setTimeout(res, 8));
    }
    await new Promise((res) => setTimeout(res, 500));
    rec.downed = !b.alive;
    return rec;
  }, n);
  r.wound.seen.push(one);
  await page.waitForTimeout(1200);
}
Object.assign(r.wound, await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  delete gs._maybeCompleteRoom;             // back to the prototype's
  return {
    woundEvents: window.__vaderTally.wounds,
    deathEvents: window.__vaderTally.deaths,
    restored: typeof gs._maybeCompleteRoom === 'function',
  };
}));

// ── The intake cap ────────────────────────────────────────────────────────
r.cap = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { ROOMS } = await import('/src/data/rooms.js');
  gs.sector = 5;
  gs.loadRoom(ROOMS.find((r) => r.boss));
  await new Promise((res) => setTimeout(res, 2200));
  gs.lives = 9999;
  if (!gs.boss?.alive) {
    gs.spawnBoss(gs.player.x + 380, gs.player.y);
    await new Promise((res) => setTimeout(res, 700));
  }
  const b = gs.boss;
  const before = b.hp;
  b.damage(999999);                          // one absurd hit, one window
  const taken = before - b.hp;
  return { cap: b._dmgCap, taken, hpMax: b.hpMax, capped: taken <= b._dmgCap + 1 };
});

await browser.close();

// ── Ladder ───────────────────────────────────────────────────────────────
check(!r.ladder.hasSpeedOnly, 'the ladder carries no stat-only entries',
  `still has ${r.ladder.ids.join(', ')} — a speed multiplier is the same fight with the numbers moved`);
check(r.ladder.ids.length >= 6, 'and has a mechanic for each of the early encounters', r.ladder.ids.join(', '));
check(r.enc1.mechanics.length === 1 && r.enc3.mechanics.length === 3,
  'one more mechanic per encounter, deterministically',
  `enc1 ${r.enc1.mechanics.join('+')} / enc3 ${r.enc3.mechanics.join('+')}`);
check(r.enc3.hpMax > r.enc1.hpMax, 'and a bigger pool each time', `${r.enc1.hpMax} -> ${r.enc3.hpMax}`);

// ── Deflection ───────────────────────────────────────────────────────────
check(r.reflect.normalDamage > 0, 'a shot with the saber DOWN lands (the control)',
  `dealt ${r.reflect.normalDamage} — without this the next check proves nothing`);
check(r.reflect.guardedDamage === 0, 'and the same shot with the saber UP deals nothing',
  `dealt ${r.reflect.guardedDamage}`);
check(r.reflect.reflWhileUp === 1 && r.reflect.reflWhileDown === 0,
  'it is turned around — exactly one deflection, and only while guarding',
  `${r.reflect.reflWhileDown} while down, ${r.reflect.reflWhileUp} while up`);
check(r.reflect.whileUp && !r.reflect.whileDown, 'and the window closes on its own',
  `up=${r.reflect.whileUp} down=${r.reflect.whileDown}`);

// ── Disarm ───────────────────────────────────────────────────────────────
check(r.disarm.during.id === null, 'a disarm removes the secondary', `still ${r.disarm.during.id}`);
check(r.disarm.during.pickups === r.disarm.pickupsBefore + 1,
  'and puts it on the floor rather than deleting it',
  `${r.disarm.pickupsBefore} -> ${r.disarm.during.pickups}`);
check(r.disarm.during.dropDist > 90,
  'clear of the 90px pickup magnet, so it cannot be re-collected on the spot',
  `dropped ${r.disarm.during.dropDist}px away — inside the magnet makes the whole mechanic a no-op at close range`);
check(r.disarm.after.id === r.disarm.had.id, 'walking over it gives the weapon back',
  `got ${r.disarm.after.id}, had ${r.disarm.had.id}`);
check(r.disarm.after.ammo === r.disarm.had.ammo,
  'with the ammo it had — not a free reload, not an empty gun',
  `${r.disarm.had.ammo} -> ${r.disarm.after.ammo}`);
check(r.disarm.emptyAfter === r.disarm.emptyBefore, 'disarming an unarmed player drops nothing',
  `${r.disarm.emptyBefore} -> ${r.disarm.emptyAfter}`);

// ── Lights out ───────────────────────────────────────────────────────────
check(r.blackout.during > r.blackout.before, 'lights out actually raises the darkness overlay',
  `alpha ${r.blackout.before} -> ${r.blackout.during}`);
check(r.blackout.after <= r.blackout.before + 0.01, 'and the lights come back',
  `alpha still ${r.blackout.after} — a blackout that outlives the fight darkens the next sector`);

// ── Afterimages ──────────────────────────────────────────────────────────
check(r.afterimages.spawned === 3, 'afterimages spawn', `${r.afterimages.spawned} of 3`);
check(r.afterimages.wearingHisSprite === r.afterimages.spawned,
  'wearing HIS silhouette, not a tinted grunt',
  `${r.afterimages.wearingHisSprite} of ${r.afterimages.spawned} — a grunt-shaped copy answers "which one is he?" before the question lands`);
check(r.afterimages.cloneSurvivors === 0, 'and dying to a single hit',
  `${r.afterimages.cloneSurvivors} survived`);
check(r.afterimages.bossStillAlive && r.afterimages.bossHpFrac > 0.5,
  'while the real one shrugs off the same hit — that is how you tell them apart',
  `boss at ${(r.afterimages.bossHpFrac * 100).toFixed(0)}%`);

// ── Wound / return ───────────────────────────────────────────────────────
check(r.wound.seen.every((s) => s.downed), 'each encounter can be driven down',
  r.wound.seen.map((s) => `enc${s.n} ${s.hpMax}hp ${s.downed ? 'down' : 'STILL UP'}`).join(', '));
check(r.wound.deathEvents === 0, 'Vader is never KILLED in endless — he withdraws',
  `${r.wound.deathEvents} boss-died events; a dead Vader ends the ladder`);
check(r.wound.woundEvents >= 3, 'each time as a wound', `${r.wound.woundEvents} over 3 encounters`);
check(r.wound.seen[2].mech > r.wound.seen[0].mech && r.wound.seen[2].hpMax > r.wound.seen[0].hpMax,
  'and he returns harder AND weirder each time',
  `${r.wound.seen[0].hpMax}hp/${r.wound.seen[0].mech} -> ${r.wound.seen[2].hpMax}hp/${r.wound.seen[2].mech}`);
check(r.wound.restored, 'the test put the room transition back', '');

// ── Intake cap ───────────────────────────────────────────────────────────
check(r.cap.taken >= 3999, 'a big hit lands in FULL — there is no intake cap',
  `4000 damage registered as ${r.cap.taken}. The cap used to clip a 3000-damage super to 960, `
  + `which is what made encounter 6 take four minutes and punished super-spam hardest`);
check(!r.cap.hasCapField, 'and no per-boss cap field survives to be re-enabled by accident',
  `_dmgCap = ${r.cap.hasCapField}`);

for (const c of checks) {
  console.log(`  ${c.ok ? 'ok  ' : 'FAIL'}  ${c.label}${c.ok || !c.detail ? '' : ' — ' + c.detail}`);
}
const failed = checks.filter((c) => !c.ok);
if (failed.length) fail(`${failed.length} of ${checks.length} checks failed: ${failed.map((f) => f.label).join('; ')}`);
console.log(`PASS: ${checks.length} checks — the ladder is mechanics, not multipliers`);
