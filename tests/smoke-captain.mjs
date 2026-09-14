// THE IMPERIAL SHOCK CAPTAIN — PHASE B.2, STRUCTURAL PROPERTIES ONLY.
//
// IT ASSERTS NOTHING ABOUT QUALITY. Whether the animation is crisp, whether the
// rifle has weight, whether it feels elite — those are handset questions and a
// number claiming to answer one is decoration. `smoke-champion` froze exactly
// such a mistake ("the Champion is the slowest thing on the floor") into a
// passing check, and a test that pins a mistake is worse than no test.
//
// What it does assert is the set of things that can be WRONG INVISIBLY:
//   - the model and its broken twin load, and the animation set exists
//   - the bolt leaves the MUZZLE rather than the body centre
//   - the burst cadence is the authored one, not a hose
//   - the armour transitions exactly once and takes the body with it
//   - chip fire cannot stun-lock it — the loop resumes
//   - nothing it owns outlives it, and nothing leaks into normal Endless
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
  await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 3571 }));
  await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
  await page.waitForTimeout(2200);
  const out = await fn(page);
  await page.close();
  return out;
}

// ── 1. THE MODEL, ITS BROKEN TWIN, AND THE ANIMATION SET ───────────────────
const model = await run('?nodlg=1&champdbg=1', async (page) => page.evaluate(async () => {
  const { CHAMPION, ENEMY, BOSS } = await import('/src/config.js');
  const { setGodMode } = await import('/src/systems/debug.js');
  const { CAPTAIN_FRAMES, CAPTAIN_MUZZLE_PX } = await import('/src/systems/pixelArt.js');
  setGodMode(true);
  const gs = window.game.scene.getScene('Game');
  const c = gs.enemies.getChildren().find((e) => e.alive && e.isChampion)
    || gs.spawnChampion(gs.player.x + 420, gs.player.y, 'captain');
  const def = CHAMPION.captain;
  const A = window.game.anims;
  const dirs = ['front', 'back', 'side'];
  const needed = [];
  for (const p of ['captain', 'captainbrk']) {
    for (const d of dirs) {
      for (const n of ['idle', 'walk', 'strafe', 'brace', 'fire', 'recoil', 'stagger',
        'raise', 'thrust', 'recover']) needed.push(`${p}-${n}-${d}`);
    }
  }
  const grunt = gs.textures.get('grunt').get(0);
  const boss = gs.textures.get('boss').get(0);
  const cap = gs.textures.get(def.tex).get(0);
  return {
    id: c._championId,
    tex: c.texture.key,
    frames: gs.textures.get(def.tex).getFrameNames().length,
    brokenFrames: gs.textures.get(def.texBroken).getFrameNames().length,
    declaredFrames: CAPTAIN_FRAMES.total,
    missingAnims: needed.filter((k) => !A.exists(k)),
    idleFrameCount: A.get('captain-idle-front')?.frames.length ?? 0,
    walkFrameCount: A.get('captain-walk-front')?.frames.length ?? 0,
    strafeFrameCount: A.get('captain-strafe-front')?.frames.length ?? 0,
    // 1x hierarchy, in pixels, on the real textures.
    size: [cap.width, cap.height],
    gruntSize: [grunt.width, grunt.height],
    bossSize: [boss.width, boss.height],
    bodyR: c.body.radius,
    bossR: BOSS.radius,
    gruntR: ENEMY.grunt.radius,
    // The weapon is an OVERLAY, not painted into the body.
    hasWeapon: !!c.weaponSprite,
    weaponTex: c.weaponSprite?.texture.key,
    weaponOrigin: [c.weaponSprite?.originX, c.weaponSprite?.originY],
    muzzlePx: CAPTAIN_MUZZLE_PX,
    weaponLen: gs.textures.get('wpn-captain').getSourceImage().width,
    ownsAnim: c._ownsAnim,
    // Its own hostile pool, not the green trooper one.
    poolTex: gs.captainBullets.defaultKey ?? gs.captainBullets._tex ?? null,
    inHostile: gs.hostileBullets.includes(gs.captainBullets),
  };
}));
check(model.id === 'captain', 'the flag spawns the SHOCK CAPTAIN by default', model.id);
check(model.tex === 'champ-captain', 'it wears its own sheet', model.tex);
check(model.frames === model.declaredFrames && model.brokenFrames === model.declaredFrames,
  'both durability sheets carry the full declared frame set',
  `${model.frames}/${model.brokenFrames} vs ${model.declaredFrames}`);
check(model.missingAnims.length === 0,
  'every animation key both states need is registered', model.missingAnims.join(','));
check(model.idleFrameCount >= 2,
  'IDLE IS NOT ONE FRAME — an elite does not freeze between bursts', `${model.idleFrameCount}`);
check(model.walkFrameCount === 6, 'the walk is a six-frame cycle', `${model.walkFrameCount}`);
check(model.strafeFrameCount >= 2,
  'the lateral step is its OWN cycle, not the forward walk played sideways',
  `${model.strafeFrameCount}`);
check(model.size[0] > model.gruntSize[0] && model.size[0] < model.bossSize[0],
  'at 1x it is bigger than the rank and file and smaller than Vader',
  `${model.size} vs grunt ${model.gruntSize} / boss ${model.bossSize}`);
// NAVIGABILITY IS DERIVED, NOT ASSUMED. `NavGrid.build` inflates a body rect by
// 23px per side, so anywhere the Ø112 boss fits, this must fit too.
check(model.bodyR < model.bossR && model.bodyR > model.gruntR,
  'its body is between the rank and file and the boss, so it paths where Vader paths',
  `r=${model.bodyR} (grunt ${model.gruntR}, boss ${model.bossR})`);
check(model.hasWeapon && model.weaponTex === 'wpn-captain',
  'the rifle is a separate overlay, not painted into the body sheet', model.weaponTex);
check(model.weaponOrigin[0] === 0.15 && model.weaponOrigin[1] === 0.5,
  'on the same overlay origin contract every armed actor here uses',
  JSON.stringify(model.weaponOrigin));
check(Math.abs(model.muzzlePx - model.weaponLen * 0.85) < 0.01,
  'the muzzle offset is DERIVED from the overlay, never a literal',
  `${model.muzzlePx} vs ${model.weaponLen}*0.85`);
check(model.ownsAnim === true, 'it drives its own animation rather than the stock selector');
check(model.inHostile === true,
  'its bullets are in `hostileBullets`, so every sweep that must see them does');

// ── 2. THE BURST — CADENCE, AND WHERE THE ROUND COMES FROM ─────────────────
//
// A REFUSED CALL READS EXACTLY LIKE A FAILED ONE, so this asserts the burst
// actually ran before it asserts anything about its shape.
const burst = await run('?nodlg=1&champdbg=1', async (page) => page.evaluate(async () => {
  const { CHAMPION } = await import('/src/config.js');
  const { CAPTAIN_MUZZLE_PX } = await import('/src/systems/pixelArt.js');
  const { setGodMode } = await import('/src/systems/debug.js');
  setGodMode(true);
  const gs = window.game.scene.getScene('Game');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  gs.arenaActive = false;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  const def = CHAMPION.captain;
  const c = gs.spawnChampion(gs.player.x + 380, gs.player.y, 'captain');
  const shots = [];
  // A BULLET'S GEOMETRY MUST BE SAMPLED IN FLIGHT. Reading the pool after the
  // fact finds whatever happens to be alive — often nothing, and then `?? 0`
  // reports a radius of zero and the check fails on the instrument rather than
  // on the code. Wrap `fire` and photograph the body on the frame it is sized.
  let geom = null;
  const rawFire = gs.captainBullets.fire.bind(gs.captainBullets);
  gs.captainBullets.fire = (...a) => {
    const b = rawFire(...a);
    if (b && !geom) geom = { scaleX: b.scaleX, radius: b.body?.radius ?? 0, tex: b.texture.key };
    return b;
  };
  const real = gs.fireCaptainBolt.bind(gs);
  gs.fireCaptainBolt = (cap, mx, my, ang) => {
    shots.push({
      t: performance.now(), mx, my, ang,
      fromBody: Math.hypot(mx - cap.x, my - cap.y),
      fromWeapon: Math.hypot(mx - cap.weaponSprite.x, my - cap.weaponSprite.y),
      state: cap._cap,
    });
    return real(cap, mx, my, ang);
  };
  // Sampled from inside the page: a `page.evaluate` poll costs 200-400ms a
  // round trip and would miss a 190ms gap entirely.
  const seenStates = new Set();
  const hook = () => { if (c.alive) seenStates.add(c._cap); };
  gs.events.on('postupdate', hook);
  await wait(9000);
  gs.events.off('postupdate', hook);
  const gaps = shots.slice(1).map((s, i) => s.t - shots[i].t);
  return {
    n: shots.length,
    allFromWeapon: shots.every((s) => s.fromWeapon > 40 && s.fromBody > def.radius),
    muzzleErr: shots.map((s) => Math.abs(s.fromWeapon - CAPTAIN_MUZZLE_PX)),
    allInBurst: shots.every((s) => s.state === 'burst'),
    gaps,
    states: [...seenStates],
    bulletTex: geom?.tex ?? null,
    bulletScaleX: geom?.scaleX ?? null,
    bulletRadius: geom?.radius ?? null,
    sampled: !!geom,
    bulletTexW: gs.textures.get('bullet-captain').getSourceImage().width,
    cfg: { rounds: def.burstRounds, gap: def.burstGapMs, every: def.fireEveryMs },
  };
}));
check(burst.n >= burst.cfg.rounds,
  'the burst actually ran (a refused cast reads exactly like a failed one)', `${burst.n} shots`);
check(burst.allInBurst, 'every round left during the BURST state, never mid-walk');
check(burst.allFromWeapon && burst.muzzleErr.every((e) => e < 1.5),
  'the bolt leaves the MUZZLE, not the body centre — so the flash and the round agree',
  `max err ${Math.max(0, ...burst.muzzleErr).toFixed(2)}px`);
{
  // Within-burst gaps must be near the authored spacing; between-burst gaps must
  // be much longer. That pair is the difference between heavy aimed fire and a
  // hose, and neither half means anything alone.
  const inBurst = burst.gaps.filter((g) => g < burst.cfg.every * 0.6);
  const between = burst.gaps.filter((g) => g >= burst.cfg.every * 0.6);
  const okIn = inBurst.length > 0 && inBurst.every((g) => g >= burst.cfg.gap * 0.6);
  check(okIn, 'rounds inside a burst are spaced, not a continuous stream',
    `gaps ${inBurst.map((g) => Math.round(g)).join(',')} vs ${burst.cfg.gap}ms`);
  check(between.length > 0, 'and bursts are separated by the authored recovery',
    `between-burst gaps ${between.map((g) => Math.round(g)).join(',')}`);
}
check(burst.states.includes('brace') && burst.states.includes('recover'),
  'the shot is an ARC — it braces before and recovers after', burst.states.join(','));
check(burst.states.some((s) => s === 'strafe' || s === 'advance' || s === 'giveground'),
  'and it moves for a stated combat reason between bursts', burst.states.join(','));
check(burst.bulletTex === 'bullet-captain',
  'the round is its own texture in its own pool', `${burst.bulletTex}`);
// A PROJECTILE'S SPEED CAN SILENTLY RESIZE ITS HITBOX: `Bullet.fire` stretches
// the tracer by clamp(speed/620, 1, 2.2) and `Body.updateBounds` recomputes
// width from |scaleX|. Under 620 the clamp is exactly 1 and nothing moves.
check(burst.sampled && Math.abs(burst.bulletScaleX - 1) < 0.001
  && burst.bulletRadius * 2 === burst.bulletTexW,
  'the bolt speed is under the tracer-stretch clamp, so its hitbox is the texture',
  `scaleX ${burst.bulletScaleX}, r*2 ${burst.bulletRadius * 2} vs ${burst.bulletTexW}`);

// ── 3. THE ARMOUR, AND THE STAGGER THAT MUST NOT LOCK ──────────────────────
const durab = await run('?nodlg=1&champdbg=1', async (page) => page.evaluate(async () => {
  const { CHAMPION } = await import('/src/config.js');
  const { setGodMode } = await import('/src/systems/debug.js');
  setGodMode(true);
  const gs = window.game.scene.getScene('Game');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  gs.arenaActive = false;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  const def = CHAMPION.captain;
  const c = gs.spawnChampion(gs.player.x + 380, gs.player.y, 'captain');
  let breaks = 0;
  gs.events.on('champion-armour-broken', () => { breaks++; });

  // (a) chip fire against the armour: the body must not drop and the loop must
  //     keep running. `Enemy.damage` sets `_staggerMs = 90` on EVERY hit, so an
  //     actor that yields on that field is stun-locked by ordinary fire.
  const chipStates = new Set();
  const hook = () => { if (c.alive) chipStates.add(c._cap); };
  gs.events.on('postupdate', hook);
  const hp0 = c.hp, arm0 = c.armour;
  for (let i = 0; i < 24; i++) { c.damage(60, { x: 8, y: 0 }); await wait(90); }
  gs.events.off('postupdate', hook);
  const afterChip = { hp: c.hp, armour: c.armour, broken: c.armourBroken, states: [...chipStates] };

  // (b) one concentrated commitment: the layer breaks AND the body is hurt.
  const armourLeft = c.armour;
  const over = armourLeft / def.armourTake + 1200;
  const hpBefore = c.hp;
  c.damage(over, null);
  const afterBreak = {
    hp: c.hp, hpBefore, armour: c.armour, broken: c.armourBroken,
    prefix: c._animPrefix, tex: c.texture.key, breaks,
    expectedSpill: 1200 * def.armourSpill,
  };
  // (c) it stays broken and the transition cannot repeat.
  c.damage(400, null);
  await wait(400);
  const after2 = { breaks, prefix: c._animPrefix, alive: c.alive, state: c._cap };
  return { hp0, arm0, afterChip, afterBreak, after2, def: {
    hp: def.hp, armour: def.armour, spill: def.armourSpill, take: def.armourTake } };
}));
check(durab.afterChip.broken === false && durab.afterChip.hp === durab.hp0,
  'while the armour holds, chip fire spends the LAYER and not the body',
  `hp ${durab.afterChip.hp}/${durab.hp0}, armour ${Math.round(durab.afterChip.armour)}`);
check(durab.afterChip.armour < durab.arm0,
  'and the layer is genuinely being spent — shooting it is productive',
  `${Math.round(durab.afterChip.armour)} of ${durab.arm0}`);
check(durab.afterChip.states.some((s) => s !== 'stagger'),
  'CHIP FIRE CANNOT STUN-LOCK IT — the combat loop keeps running under fire',
  durab.afterChip.states.join(','));
check(durab.afterBreak.broken === true && durab.afterBreak.breaks === 1,
  'one concentrated commitment breaks the layer, exactly once',
  `breaks=${durab.afterBreak.breaks}`);
check(durab.afterBreak.tex === 'champ-captain-broken' && durab.afterBreak.prefix === 'captainbrk',
  'and the SILHOUETTE changes with it — a second sheet, not a tint',
  `${durab.afterBreak.tex} / ${durab.afterBreak.prefix}`);
check(durab.afterBreak.hp < durab.afterBreak.hpBefore,
  'overkill past the layer carries through: a Super breaks it AND hurts',
  `${durab.afterBreak.hpBefore} -> ${durab.afterBreak.hp} (spill ${Math.round(durab.afterBreak.expectedSpill)})`);
check(durab.after2.breaks === 1 && durab.after2.prefix === 'captainbrk',
  'the transition is idempotent and there is no second layer', `breaks=${durab.after2.breaks}`);
check(durab.after2.alive === true && durab.after2.state !== 'stagger',
  'and it is still fighting afterwards', durab.after2.state);

// ── 4. CLEANUP, AND THE NEGATIVE HALF ──────────────────────────────────────
//
// The negative half is the important half: "a Captain appears" is only
// meaningful next to "and none appears without the flag".
const clean = await run('?nodlg=1&champdbg=1', async (page) => page.evaluate(async () => {
  const { setGodMode } = await import('/src/systems/debug.js');
  const { ROOMS } = await import('/src/data/rooms.js');
  setGodMode(true);
  const gs = window.game.scene.getScene('Game');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  gs.arenaActive = false;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  const c = gs.spawnChampion(gs.player.x + 380, gs.player.y, 'captain');
  await wait(2600);                       // long enough to have fired
  const firedBefore = gs.captainBullets.getChildren().some((b) => b.active) ||
    gs.captainBullets.getChildren().length > 0;
  const bar = () => !!c._armourBar;
  const hadBar = bar();
  c.damage(99999, null);                  // kill it
  await wait(600);
  const afterDeath = { alive: c.alive, bar: bar() };
  // A SECOND CAPTAIN IS THE FLAG WORKING, NOT A LEAK. `_maybeInjectChampion`
  // rides `_startWave`, and `loadRoom` starts one — so counting live champions
  // after a room change measures the debug injector, not the teardown. The
  // question is whether THIS instance survives, so hold the instance.
  const survivor = () => gs.enemies.getChildren().includes(c);
  gs.loadRoom(ROOMS.find((r) => r.id === 'detention'));
  await wait(2400);
  return {
    firedBefore, hadBar, afterDeath,
    oldSurvives: survivor(),
    oldActive: !!c.active,
    boltsAfterRoom: gs.captainBullets.getChildren().filter((b) => b.active).length,
  };
}));
check(clean.hadBar, 'the armour layer has its own readout while it is intact');
check(clean.afterDeath.alive === false && clean.afterDeath.bar === false,
  'nothing it owns outlives it');
check(clean.oldSurvives === false && clean.oldActive === false && clean.boltsAfterRoom === 0,
  'and a room change leaves neither the dead actor nor its rounds behind',
  `survives=${clean.oldSurvives} active=${clean.oldActive} bolts=${clean.boltsAfterRoom}`);

const off = await run('?nodlg=1', async (page) => page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  gs._startWave(0);
  await wait(2600);
  return {
    champions: gs.enemies.getChildren().filter((e) => e.alive && e.isChampion).length,
    injected: gs._maybeInjectChampion(gs._wave),
    bolts: gs.captainBullets.getChildren().filter((b) => b.active).length,
  };
}));
check(off.champions === 0 && off.injected === null,
  'WITHOUT THE FLAG NORMAL ENDLESS SPAWNS NONE, and injection refuses outright',
  `${off.champions} alive, injected=${off.injected}`);
check(off.bolts === 0, 'and no Captain round exists in a normal run');

// ── 5. WHICH CANDIDATE THE FLAG ACTUALLY PRODUCES ──────────────────────────
//
// READ THE ACTOR, NOT THE FLAG. A dynamic `import('/src/systems/debug.js')`
// inside `page.evaluate` can hand back a SECOND module instance carrying the
// authored defaults rather than the running game's state — the same trap
// `CLAUDE.md` records for `config.js`. An earlier version of this check asked
// `getChampWhich()` and was told 'captain' while the sprite on the floor was
// plainly a Harrower. `spawnChampion` with no explicit id resolves the real
// default through the real code path, and its texture cannot lie.
const defaults = {};
for (const [q, label] of [['1', 'flag'], ['harrower', 'harrower'], ['interdictor', 'interdictor']]) {
  defaults[label] = await run(`?nodlg=1&champdbg=${q}`, async (page) => page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    gs.arenaActive = false;
    gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
    const c = gs.spawnChampion(gs.player.x + 420, gs.player.y);   // no explicit id
    return { tex: c.texture.key, id: c._championId ?? c.def?.id ?? null };
  }));
}
check(defaults.flag.tex === 'champ-captain',
  'the bare flag produces the Captain — a rejected prototype left as the default is how a handset session reviews the wrong actor',
  defaults.flag.tex);
check(defaults.harrower.tex !== 'champ-captain' && defaults.interdictor.tex !== 'champ-captain',
  'and an explicit id still reaches each rejected prototype for a side-by-side',
  `${defaults.harrower.tex} / ${defaults.interdictor.tex}`);

await browser.close();

for (const c of checks) {
  console.log(`  ${c.ok ? 'ok  ' : 'FAIL'}  ${c.label}${c.ok || !c.detail ? '' : ' — ' + c.detail}`);
}
const failed = checks.filter((c) => !c.ok);
if (failed.length) fail(`${failed.length} of ${checks.length} checks failed: ${failed.map((f) => f.label).join('; ')}`);
console.log(`PASS: ${checks.length} checks — the Shock Captain moves, fights, breaks once, and stays debug-only`);
