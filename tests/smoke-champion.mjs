// THE CHAMPION — structural and semantic properties only.
//
// It asserts nothing about whether the Interdictor is fun, fair or well-tuned:
// those are handset questions and a number claiming to answer one is
// decoration. What it does assert is the set of things that can be WRONG
// invisibly — a hazard that outlives its author, a zone whose damage does not
// match its picture, a telegraph that does not precede its effect, a Champion
// leaking into normal Endless — because every one of those is a bug the player
// would meet before any test would.
//
// The negative half is the important half, exactly as in `smoke-encdbg`: the
// vertical slice is DEBUG-ONLY, so "a Champion appears" is only meaningful next
// to "and none appears without the flag".

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
  await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 2468 }));
  await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
  await page.waitForTimeout(2200);
  const out = await fn(page);
  await page.close();
  return out;
}

// ── 1. Identity, body and navigability ─────────────────────────────────────
const ident = await run('?nodlg=1&champdbg=1', async (page) => page.evaluate(async () => {
  const { CHAMPION, ENEMY, BOSS } = await import('/src/config.js');
  const gs = window.game.scene.getScene('Game');
  const { setGodMode } = await import('/src/systems/debug.js');
  setGodMode(true);
  const c = gs.enemies.getChildren().find((e) => e.alive && e.isChampion)
    || gs.spawnChampion(gs.player.x + 420, gs.player.y);
  const def = CHAMPION.interdictor;
  return {
    tex: c.texture.key,
    ordinaryTextures: [...new Set(gs.enemies.getChildren().filter((e) => !e.isChampion).map((e) => e.texture.key))],
    id: c._championId,
    bodyR: c.body.radius,
    cfgR: def.radius,
    spriteW: c.width,
    hp: c.hpMax,
    gruntHp: ENEMY.grunt.hp,
    bossR: BOSS.radius,
    speed: c.cfg.speed,
    slowest: Math.min(...Object.values(ENEMY).map((e) => e.speed)),
    // NavGrid inflates a body rect by a fixed 23px per side. The junction's
    // authored lane is 160px and was derived for Vader's O112; anything the
    // boss can walk, this must also walk.
    needsGap: def.radius * 2 + 46,
    hasWeapon: !!c.weaponSprite,
    animExists: !!window.game.anims.exists(`${def.anim}-walk-front`),
    poseExists: !!window.game.anims.exists(`${def.anim}-raise-front`),
  };
}));
check(ident.tex === 'champ-interdictor', 'the Champion has its own sheet', ident.tex);
check(!ident.ordinaryTextures.includes(ident.tex),
  'and no ordinary enemy shares it — this is not a retinted trooper', ident.ordinaryTextures.join(','));
check(ident.animExists && ident.poseExists, 'its walk and pose animations are registered', '');
check(ident.bodyR === ident.cfgR, 'the collider is the configured body size', `${ident.bodyR} vs ${ident.cfgR}`);
check(ident.spriteW / (ident.bodyR * 2) < 2.0,
  'the art does not promise more mass than the collider has',
  `sprite ${ident.spriteW} over body ${ident.bodyR * 2}`);
check(ident.needsGap <= 160,
  'IT FITS THE JUNCTION LANE — anywhere Vader walks, it walks',
  `needs ${ident.needsGap}px against the authored 160`);
check(ident.bodyR * 2 < ident.bossR * 2, 'and it is smaller than the boss', `${ident.bodyR * 2} vs ${ident.bossR * 2}`);
check(ident.hp > ident.gruntHp * 3 && ident.hp < ident.gruntHp * 6,
  'durable, but nowhere near sponge territory', `${ident.hp} vs grunt ${ident.gruntHp}`);
check(ident.speed <= ident.slowest, 'it is the slowest thing on the floor', `${ident.speed} vs ${ident.slowest}`);
check(!ident.hasWeapon, 'IT CARRIES NO WEAPON — its threat is spatial, not a projectile', '');

// ── 2. The move: telegraph precedes effect, and the effect is placed ────────
const seam = await run('?nodlg=1&champdbg=1', async (page) => page.evaluate(async () => {
  const { CHAMPION } = await import('/src/config.js');
  const { setGodMode } = await import('/src/systems/debug.js');
  setGodMode(true);
  const gs = window.game.scene.getScene('Game');
  const def = CHAMPION.interdictor;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  gs.clearHazards();
  const c = gs.enemies.getChildren().find((e) => e.alive && e.isChampion)
    || gs.spawnChampion(gs.player.x + 420, gs.player.y);
  c.setPosition(gs.player.x + 400, gs.player.y);
  const h = gs._castChampionMove(c, 'interdict');
  const cast = { ok: !!h, x: c.x, y: c.y };

  // DURING the wind-up: a telegraph, and NO hazard. The order is the whole
  // fairness claim — a persistent zone that arrived with its warning would be
  // unavoidable by construction.
  await wait(Math.min(500, def.interdict.anticipateMs * 0.5));
  const during = {
    phase: h.phase,
    telegraphs: gs._telegraphs.length,
    hazards: gs._hazards.length,
  };

  // AFTER act: exactly one hazard.
  await wait(def.interdict.anticipateMs + 500);
  const b = gs._hazards[0];
  const after = { hazards: gs._hazards.length, len: b?.len, width: b?.width };

  // It is PLACED: it starts in front of the machine, not under it, and it does
  // not follow. Move the Champion and re-read the barrier's own origin.
  const before = b ? { x: b.x, y: b.y } : null;
  const offset = b ? Math.hypot(b.x - cast.x, b.y - cast.y) : 0;
  c.setPosition(c.x - 260, c.y - 200);
  await wait(140);
  const stayed = b && before ? (b.x === before.x && b.y === before.y) : false;

  // THE HIT TEST IS THE PICTURE. Sample the barrier's own geometry.
  let bounds = null;
  if (b) {
    const cs = Math.cos(b.angle), sn = Math.sin(b.angle);
    const at = (along, across) => b.contains(
      b.x + cs * along - sn * across, b.y + sn * along + cs * across);
    bounds = {
      midline: at(b.len * 0.5, 0),
      justInside: at(b.len * 0.5, b.width / 2 - 2),
      justOutside: at(b.len * 0.5, b.width / 2 + 4),
      pastEnd: at(b.len + 12, 0),
      behindStart: at(-b.width, 0),
    };
  }
  return { cast, during, after, offset, stayed, bounds,
    champR: def.radius, laneLen: def.interdict.laneLen, laneW: def.interdict.laneWidth };
}));
check(seam.cast.ok, 'the move casts through the real four-beat runner', '');
check(seam.during.telegraphs >= 1 && seam.during.hazards === 0,
  'THE TELEGRAPH PRECEDES THE EFFECT — no hazard exists during the wind-up',
  JSON.stringify(seam.during));
check(seam.after.hazards === 1, 'exactly one seam exists after the act beat', `${seam.after.hazards}`);
check(seam.after.len === seam.laneLen && seam.after.width === seam.laneW,
  'and it is the authored geometry', JSON.stringify(seam.after));
check(seam.offset > seam.champR * 0.8 && seam.offset < seam.champR * 1.6,
  'it starts one body-radius IN FRONT of the machine, not underneath it',
  `${seam.offset.toFixed(0)}px against radius ${seam.champR}`);
check(seam.stayed, 'IT IS PLACED, NOT TETHERED — moving the Champion does not move its seam', '');
check(seam.bounds?.midline === true && seam.bounds?.justInside === true,
  'the hazard covers the region it draws', JSON.stringify(seam.bounds));
check(seam.bounds?.justOutside === false && seam.bounds?.pastEnd === false
  && seam.bounds?.behindStart === false,
  'AND IT COVERS NOTHING ELSE — the shape is the hit test', JSON.stringify(seam.bounds));

// ── 3. Lifecycle: expiry, death, cancel, room change ────────────────────────
const life = await run('?nodlg=1&champdbg=1', async (page) => page.evaluate(async () => {
  const { CHAMPION } = await import('/src/config.js');
  const { setGodMode } = await import('/src/systems/debug.js');
  const { ROOMS } = await import('/src/data/rooms.js');
  setGodMode(true);
  const gs = window.game.scene.getScene('Game');
  const def = CHAMPION.interdictor;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const mk = async () => {
    gs.clearHazards();
    let c = gs.enemies.getChildren().find((e) => e.alive && e.isChampion);
    if (!c) c = gs.spawnChampion(gs.player.x + 420, gs.player.y);
    c._activeMove?.cancel?.();
    gs._castChampionMove(c, 'interdict');
    await wait(def.interdict.anticipateMs + 600);
    return c;
  };

  // EXPIRY — it goes on its own, and the list does not leak.
  //
  // TRACKED BY IDENTITY, NOT BY COUNT. The Champion runs its own clock, so
  // across a 5.5s wait it casts a SECOND interdict of its own accord and a
  // count-based check reads 1 -> 1 and reports the expiry as broken. It was,
  // the first time this ran, and the seam was expiring correctly throughout.
  const c1 = await mk();
  const b1 = gs._hazards[0];
  const born = gs._hazards.length;
  await wait(def.interdict.lifeMs + 900);
  const expired = { dead: !!b1?.dead, stillListed: gs._hazards.includes(b1) };

  // DEATH — the seam goes with the machine that drew it.
  const c2 = await mk();
  const beforeDeath = gs._hazards.length;
  c2.damage(999999);
  await wait(220);
  const afterDeath = gs._hazards.length;

  // CANCELLATION — idempotent, and it leaves no orphan timer that lands later.
  gs.clearHazards();
  let c3 = gs.enemies.getChildren().find((e) => e.alive && e.isChampion);
  if (!c3) c3 = gs.spawnChampion(gs.player.x + 420, gs.player.y);
  const h3 = gs._castChampionMove(c3, 'interdict');
  await wait(180);                       // mid wind-up
  h3.cancel(); h3.cancel();              // twice on purpose
  c3.retireBarrier(); c3.retireBarrier();
  await wait(def.interdict.anticipateMs + 900);
  const afterCancel = { hazards: gs._hazards.length, telegraphs: gs._telegraphs.length,
    performing: !!c3._performing,
    // A CANCELLED HANDLE MUST NOT BLOCK THE NEXT CAST. `MoveScript.cancel()`
    // leaves `_activeMove` set, so a scheduler testing the phase alone goes
    // inert for the rest of the room. This is the check that found that.
    recastable: !!gs._castChampionMove(c3, 'interdict') };
  c3._activeMove?.cancel?.();
  gs.clearHazards();

  // ROOM CHANGE — the scene can sweep a seam whose author is already gone.
  const c4 = await mk();
  const beforeRoom = gs._hazards.length;
  gs.loadRoom(ROOMS.find((r) => r.id === 'detention'));
  await wait(900);
  const afterRoom = { hazards: gs._hazards.length,
    champions: gs.enemies.getChildren().filter((e) => e.alive && e.isChampion).length };

  return { born, expired, beforeDeath, afterDeath, afterCancel, beforeRoom, afterRoom };
}));
check(life.born === 1 && life.expired.dead && !life.expired.stillListed,
  'a seam expires on its own clock, is destroyed and leaves the live list',
  JSON.stringify(life.expired));
check(life.beforeDeath === 1 && life.afterDeath === 0,
  'THE SEAM DIES WITH THE MACHINE — no damaging region with no author on screen',
  `${life.beforeDeath} -> ${life.afterDeath}`);
check(life.afterCancel.hazards === 0,
  'a cancelled wind-up never becomes a seam — no orphan timer lands later',
  JSON.stringify(life.afterCancel));
check(life.afterCancel.telegraphs === 0, 'and its telegraph goes with it', `${life.afterCancel.telegraphs}`);
check(life.afterCancel.performing === false, 'and the actor is released', '');
check(life.afterCancel.recastable === true,
  'A CANCELLED HANDLE IS NOT A CLAIM — the Champion can still act afterwards', '');
check(life.beforeRoom === 1 && life.afterRoom.hazards === 0,
  'a room change sweeps every seam', `${life.beforeRoom} -> ${life.afterRoom.hazards}`);

// ── 4. The negative half: no Champion without the flag ─────────────────────
const off = await run('?nodlg=1', async (page) => page.evaluate(async () => {
  const { ENCOUNTERS } = await import('/src/data/encounters.js');
  const { isChampDebug } = await import('/src/systems/debug.js');
  const gs = window.game.scene.getScene('Game');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  // Walk three waves of the real spawner and count.
  let seen = 0;
  for (let w = 0; w < 3; w++) {
    gs._startWave(w);
    await wait(700);
    seen += gs.enemies.getChildren().filter((e) => e.isChampion).length;
  }
  // And no encounter pool can name one: the production path cannot produce a
  // Champion, rather than being merely unlikely to.
  const pools = Object.values(ENCOUNTERS)
    .flatMap((e) => [...(e.lead || []), ...(e.fill || [])]);
  return {
    dbg: isChampDebug(),
    seen,
    poolMentions: pools.filter((t) => /champ|interdict/i.test(t)).length,
    injected: gs._maybeInjectChampion({ count: 8 }),
  };
}));
check(off.dbg === false, 'no flag: the Champion switch is off', '');
check(off.seen === 0, 'NORMAL ENDLESS SPAWNS NO CHAMPION across three real waves', `${off.seen}`);
check(off.poolMentions === 0, 'and no encounter pool can name one', `${off.poolMentions}`);
check(off.injected === null, 'the injector itself refuses without the flag', `${off.injected}`);

// ── 5. Frozen neighbours: Phase A, Nemesis and the boss room ───────────────
const frozen = await run('?nodlg=1&champdbg=1', async (page) => page.evaluate(async () => {
  const { ENCOUNTERS, ENCOUNTER_PLAN } = await import('/src/data/encounters.js');
  const { NEMESIS_MOVES, KITS } = await import('/src/data/nemesisMoves.js');
  const { ROOMS } = await import('/src/data/rooms.js');
  const gs = window.game.scene.getScene('Game');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // Boss room: the injector must refuse there even with the flag on.
  gs.loadRoom(ROOMS.find((r) => r.boss));
  await wait(900);
  const bossInject = gs._maybeInjectChampion({ count: 8 });
  const bossChamps = gs.enemies.getChildren().filter((e) => e.isChampion).length;

  // Duel wave: likewise.
  gs.loadRoom(ROOMS.find((r) => r.id === 'detention'));
  await wait(900);
  const duelInject = gs._maybeInjectChampion({ miniBoss: true, count: 8 });

  return {
    bossInject, bossChamps, duelInject,
    encounters: Object.keys(ENCOUNTERS).length,
    encSignature: Object.values(ENCOUNTERS)
      .map((e) => `${e.id}:${e.gate}:${(e.lead || []).join('')}:${(e.fill || []).join('')}`).join('|'),
    planRooms: Object.keys(ENCOUNTER_PLAN).sort().join(','),
    nemMoves: NEMESIS_MOVES.length,
    nemKits: Object.keys(KITS).length,
  };
}));
check(frozen.bossInject === null && frozen.bossChamps === 0,
  'THE BOSS ROOM IS UNTOUCHED — no Champion, flag or no flag', `${frozen.bossChamps}`);
check(frozen.duelInject === null, 'and the Nemesis duel wave is untouched', '');
check(frozen.encounters === 6 && frozen.planRooms === 'corridor,detention,hangar',
  'PHASE A IS UNCHANGED — six archetypes, three planned arenas', frozen.planRooms);
check(/vanguard:single/.test(frozen.encSignature) && /crossfire:split/.test(frozen.encSignature)
  && /sniperNest:spread/.test(frozen.encSignature),
  'and the approved compositions and gate rules are intact', '');
check(frozen.nemMoves === 14 && frozen.nemKits === 5,
  'NEMESIS IS UNCHANGED — 14 moves, 5 kits, nothing migrated',
  `${frozen.nemMoves}/${frozen.nemKits}`);

// ── 6. With the flag: exactly one, in the real encounter ───────────────────
const on = await run('?nodlg=1&champdbg=1&encdbg=vanguard', async (page) => page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  gs._startWave(0);
  await wait(900);
  const first = gs.enemies.getChildren().filter((e) => e.alive && e.isChampion).length;
  // Re-entering the same wave must not stack a second one.
  gs._maybeInjectChampion(gs._wave);
  gs._maybeInjectChampion(gs._wave);
  await wait(300);
  return {
    first,
    afterRepeat: gs.enemies.getChildren().filter((e) => e.alive && e.isChampion).length,
    encounter: gs._encounter?.id ?? null,
    ordinary: gs.enemies.getChildren().filter((e) => e.alive && !e.isChampion).length,
  };
}));
check(on.first === 1, 'the flag injects exactly one Champion', `${on.first}`);
check(on.afterRepeat === 1, 'and re-injecting cannot stack a second', `${on.afterRepeat}`);
check(on.encounter === 'vanguard',
  'it arrives INTO the real authored encounter, not instead of it', `${on.encounter}`);

await browser.close();

for (const c of checks) {
  console.log(`  ${c.ok ? 'ok  ' : 'FAIL'}  ${c.label}${c.ok || !c.detail ? '' : ' — ' + c.detail}`);
}
const failed = checks.filter((c) => !c.ok);
if (failed.length) fail(`${failed.length} of ${checks.length} checks failed: ${failed.map((f) => f.label).join('; ')}`);
console.log(`PASS: ${checks.length} checks — the Champion is authored, placed, cleaned up, and debug-only`);
