// EVIDENCE RIG — photograph the CAUGHT SUPER once it is in the air.
//
// Phase A of the deflection work changed nothing about how Vader catches a
// super; it changed how the caught super LOOKS once it leaves him, and it
// raised its speed 300 -> 405px/s. Neither of those can be certified by an
// assertion. `smoke-deflect` proves the numbers and proves the wake lies along
// the real velocity; this rig produces the pictures a human has to look at,
// and the two runtime facts the brief asks to be checked in the running game
// rather than reasoned about from the source:
//
//   * does the HELD energy stay on Vader while he walks during the 620ms?
//   * does he resume offense after the launch, without waiting for it to land?
//
// ── SLOW MOTION, WHERE AND ONLY WHERE IT IS NEEDED ────────────────────────
//
// The launch beat is 110ms — at this harness's ~20fps that is two frames, and
// a screenshot costs longer than that, so photographing it as it happens gets
// one arbitrary point of it. So the FIRST case slows `superReleaseMs` and
// `superLaunchMs` by the same factor: the curve, the ratio and the draw path
// are all the production ones, just played back slowly. Every other case runs
// at the real constants, because a 400px flight at 405px/s is ~1s and needs no
// help.
//
//   node tests/evidence-superorb.mjs [outDir]

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';

const OUT = process.argv[2] || 'shots-orb';
mkdirSync(OUT, { recursive: true });
const URL = 'http://localhost:5173/?nodlg=1&nofreeze=1';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
page.on('pageerror', (e) => console.error('PAGE ERROR', e));

await page.goto(URL);
await page.waitForTimeout(4500);
await page.mouse.click(360, 640);
await page.waitForTimeout(800);
await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 4242 }));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(1500);

await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { ROOMS } = await import('/src/data/rooms.js');
  const { ENDLESS } = await import('/src/config.js');
  gs.sector = 3 * ENDLESS.bossEvery;
  gs.loadRoom(ROOMS.find((r) => r.boss));
  await new Promise((r) => setTimeout(r, 2200));
  gs.arenaActive = false;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  if (!gs.boss?.alive) { gs.spawnBoss(gs.player.x + 300, gs.player.y); await new Promise((r) => setTimeout(r, 700)); }
  gs.lives = 9999;
});

const shot = async (name) => {
  await page.evaluate(() => window.game.scene.getScene('Game').scene.pause());
  await page.waitForTimeout(120);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  await page.evaluate(() => window.game.scene.getScene('Game').scene.resume());
  await page.waitForTimeout(80);
  console.log(`  ${OUT}/${name}.png`);
};


// ── PHOTOGRAPHING A 1-SECOND FLIGHT AT ~20FPS ─────────────────────────────
// A `page.evaluate` round trip costs 200-400ms and the whole flight is ~1.3s,
// so "wait, then pause, then shoot" from Node photographs whatever the orb had
// become 150px later — the first version of this rig captured a mid-flight
// frame in which the orb had already landed and Vader had started a slam, and
// the picture is of the slam. So the SHUTTER IS INSIDE THE GAME: a postupdate
// hook watches for the state we want and pauses the scene on that very frame.
// Node then only has to notice that it is paused.
const armShutter = (cond) => page.evaluate((src) => {
  const gs = window.game.scene.getScene('Game');
  const test = new Function('gs', 'orb', `return (${src});`);
  window.__shutterSeen = 0; window.__shutterMin = 1e9;
  window.__shutter = () => {
    const orb = gs.bossSuperOrbs.getChildren().find((x) => x.active);
    if (orb) {
      window.__shutterSeen++;
      window.__shutterMin = Math.min(window.__shutterMin,
        Math.hypot(orb.x - gs.player.x, orb.y - gs.player.y));
    }
    let hit = false;
    try { hit = !!test(gs, orb); } catch (_) { hit = false; }
    if (hit) { gs.events.off('postupdate', window.__shutter); gs.scene.pause(); }
  };
  gs.events.on('postupdate', window.__shutter);
}, cond);

// For the dodges: the interesting frame is the CLOSEST APPROACH, and how close
// that is, is exactly what the dodge decides. A fixed radius therefore cannot
// photograph it — a 130px trigger missed a walk that cleared by 233px and the
// run produced no picture at all. This fires on the first frame where the gap
// starts growing again.
const armClosestShutter = () => page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  window.__shutterSeen = 0; window.__shutterMin = 1e9; window.__prevD = 1e9;
  window.__shutter = () => {
    const orb = gs.bossSuperOrbs.getChildren().find((x) => x.active);
    if (!orb) return;
    const d = Math.hypot(orb.x - gs.player.x, orb.y - gs.player.y);
    window.__shutterSeen++;
    window.__shutterMin = Math.min(window.__shutterMin, d);
    if (d > window.__prevD && window.__prevD < 420) {
      gs.events.off('postupdate', window.__shutter);
      gs.scene.pause();
    }
    window.__prevD = d;
  };
  gs.events.on('postupdate', window.__shutter);
});

const waitShutter = async (label) => {
  try {
    await page.waitForFunction(() => window.game.scene.getScene('Game').scene.isPaused(),
      null, { timeout: 15000, polling: 40 });
    return true;
  } catch (_) {
    const d = await page.evaluate(() => {
      const gs = window.game.scene.getScene('Game');
      gs.events.off('postupdate', window.__shutter);
      return { orbFrames: window.__shutterSeen,
               closestSeen: Math.round(window.__shutterMin) };
    });
    console.error(`SHUTTER NEVER FIRED: ${label} — ${JSON.stringify(d)}`);
    return false;
  }
};

// The next shutter is armed WHILE THE SCENE IS STILL PAUSED, before the resume.
// Arming it after the resume leaves a gap the width of a `page.evaluate` round
// trip — 200-400ms, during which a 405px/s orb covers up to 160px — and the
// state being waited for can pass inside that gap. Two of three flight shots
// were lost that way.
const shootPaused = async (name, nextCond) => {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`  ${OUT}/${name}.png`);
  if (nextCond) await armShutter(nextCond);
  await page.evaluate(() => window.game.scene.getScene('Game').scene.resume());
};

// Set the pair up for one case. `gap` is the distance between them; `pinBoss`
// false leaves Vader free to walk, which is how the "he moves during the
// stored-energy beat" condition is produced — not by shoving him.
const setup = (gap, pinBoss) => page.evaluate(async ([g, pin]) => {
  const gs = window.game.scene.getScene('Game');
  const b = gs.boss, p = gs.player;
  gs.enemies.getChildren().slice().forEach((e) => { if (e.alive) gs._destroyEnemyFully(e); });
  // Three separate switches, because the first version of this rig had them
  // fused into one pin and each of the other two quietly destroyed a
  // measurement. Healing the player every frame made every "dodge" vacuous —
  // the hit was undone before the next sample. Holding the stance open past
  // the launch made "does he resume offense?" unanswerable, because a guarding
  // Vader is forbidden to START anything. Both are needed BEFORE the release
  // and are wrong after it, so the release turns them off.
  window.__healing = true; window.__stance = true; window.__pinBoss = pin;
  window.__bossPin = null;      // never inherit the previous case's staging
  window.__pin = () => {
    gs.lives = 9999;
    gs.arenaActive = false;
    p.alive = true;
    if (window.__healing) p.hp = p.hpMax;
    // A ROLLING short window, not one 60s block. A long block cannot be
    // cancelled: `isGuarding()` forbids him to START anything, so "does he
    // resume offense after the launch?" was being answered by a rig artifact —
    // he was still guarding for another minute. A 600ms rolling window means
    // dropping the flag ends the stance almost immediately.
    if (window.__stance) b._reflectUntil = gs.time.now + 600;
    if (window.__pinBoss) {
      const at = window.__bossPin || { x: 800, y: 800 - g };
      b.setVelocity(0, 0); b.setPosition(at.x, at.y);
    }
  };
  p.setPosition(800, 800); p.setVelocity(0, 0);
  b.setPosition(800, 800 - g); b.setVelocity(0, 0);
  gs.events.on('postupdate', window.__pin);
  // Sampled every frame for the whole case: the held orb's offset from Vader,
  // how far Vader walks while holding, and when he next commits to offense.
  window.__probe = { holdFrames: 0, maxAnchorErr: 0, steadyMaxErr: 0,
                     errAfterShove: [], lastBossAt: null,
                     bossWalk: 0, bossAt: null, shoved: false,
                     releasedAt: null, offenseAfterMs: null, orbAliveAtOffense: null,
                     flightFrames: 0, launchSeen: 0, minOrbDist: 1e9, hurts: [],
                     episodes: 0, epMs: [], epStartMs: 0, orbWasAlive: false,
                     orbSpeed: null, orbDamage: null, orbRadius: null,
                     orbScaleX: null, maxGhosts: 0, coronaFrames: 0 };
  // WHAT ACTUALLY HURT THEM. The first run of this rig called a case "took
  // damage: true" and I nearly wrote it up as a failed dodge — the numbers were
  // ~270 and ~300, and the orb deals a flat 455, so it had been Vader landing
  // something of his own while the orb sailed past. A dodge measured as "hp
  // went down at some point afterwards" is not a measurement of the dodge.
  // Held so teardown can remove it. The first version registered a fresh one
  // per case and never removed any, so by case 4 four listeners were writing
  // the same hit into the log and it read as four separate 455s against an hp
  // bar that had only moved once.
  window.__hurtFn = (amt) => {
    const orb = gs.bossSuperOrbs.getChildren().find((x) => x.active);
    window.__probe.hurts.push({
      amt: Math.round(amt),
      hpAfter: Math.round(p.hp),
      atMs: Math.round(gs.time.now),
      orbAlive: !!orb,
      orbDist: orb ? Math.round(Math.hypot(orb.x - p.x, orb.y - p.y)) : null,
    });
    if (window.__pauseOnOrbHit && amt === 455) gs.scene.pause();
  };
  gs.events.on('player-hurt', window.__hurtFn);
  window.__sample = () => {
    const pr = window.__probe, o = b._absorbOrb;
    if ((b._absorbCount > 0 || b._releaseT > 0) && o) {
      pr.holdFrames++;
      // NOT the raw distance from him — the held orb is DRAWN out at arm's
      // length on his aim bearing, so a healthy one sits ~66px away and a raw
      // gap says nothing. What matters is whether it is where the draw code
      // means to put it, so measure the error against that anchor. A graphic
      // left behind in world space while he walks shows up here as an error
      // that grows with his walk; an attached one stays at ~0 forever.
      const ax = b.x + Math.cos(b._aim) * (window.__bossR + 4);
      const ay = b.y + Math.sin(b._aim) * (window.__bossR + 4) - 6;
      const err = Math.hypot(o.x - ax, o.y - ay);
      // Two figures, because one is not enough to answer the question. The rig
      // itself teleports him (the shove, and the re-staging), and on the frame
      // of a teleport the orb has not been redrawn yet — so a raw maximum
      // measures the rig's own jumps. `steadyMaxErr` therefore ignores frames
      // where he moved more than a walk's worth since the last sample, and
      // `errAfterShove` records the first few frames after the 140px shove,
      // which is where an orphaned graphic would show up and stay.
      const moved = pr.lastBossAt
        ? Math.hypot(b.x - pr.lastBossAt.x, b.y - pr.lastBossAt.y) : 0;
      pr.lastBossAt = { x: b.x, y: b.y };
      if (moved < 20) pr.steadyMaxErr = Math.max(pr.steadyMaxErr, err);
      if (pr.shoved && pr.errAfterShove.length < 5) pr.errAfterShove.push(Math.round(err));
      pr.maxAnchorErr = Math.max(pr.maxAnchorErr, err);
      if (pr.bossAt) pr.bossWalk += Math.hypot(b.x - pr.bossAt.x, b.y - pr.bossAt.y);
      pr.bossAt = { x: b.x, y: b.y };
      if (b._releaseT > 0 && b._releaseT < 200) pr.launchSeen++;
    }
    const orb = gs.bossSuperOrbs.getChildren().find((x) => x.active);
    // A super he only half-catches releases what he has, and the pellets still
    // in the air are then caught separately — so one volley can produce two
    // orbs, minutes of scene time apart. Counting the episodes keeps a flight
    // duration from being measured across the gap between two of them.
    if (orb && !pr.orbWasAlive) { pr.episodes++; pr.epStartMs = gs.time.now; }
    if (!orb && pr.orbWasAlive) {
      pr.epMs.push(Math.round(gs.time.now - pr.epStartMs));
    }
    pr.orbWasAlive = !!orb;
    if (orb) {
      // Sampled IN THE PAGE, every frame, rather than by asking across the wire
      // once the flight is over: a `page.evaluate` round trip costs 200-400ms,
      // the whole flight is ~1.3s, and every earlier attempt to photograph the
      // numbers this way came back "no orb" because it had already landed.
      pr.flightFrames++;
      pr.minOrbDist = Math.min(pr.minOrbDist, Math.hypot(orb.x - p.x, orb.y - p.y));
      pr.orbSpeed = Math.round(Math.hypot(orb.body.velocity.x, orb.body.velocity.y));
      pr.orbDamage = orb.damage;
      pr.orbRadius = orb.body.radius;
      pr.orbScaleX = orb.scaleX;
      const f = gs._superOrbFx;
      if (f) {
        pr.maxGhosts = Math.max(pr.maxGhosts, f.ghosts.filter((x) => x.visible).length);
        if (f.corona.visible) pr.coronaFrames++;
      }
    }
    if (pr.releasedAt != null && pr.offenseAfterMs == null
        && (b._performing || (b.state && b.state !== 'idle'))) {
      // ANY committed action: a scripted move (`_performing`) or the state
      // machine leaving idle for a charge or a slam. The question the brief
      // asks is whether he is free to ask the next question while the orb is
      // still crossing the room, not which particular one he picks.
      pr.offenseAfterMs = Math.round(gs.time.now - pr.releasedAt);
      pr.offenseKind = b._performing ? (b._moveId ?? 'move') : b.state;
      pr.orbAliveAtOffense = !!orb;
    }
  };
  gs.events.on('postupdate', window.__sample);
  const { BOSS } = await import('/src/config.js');
  window.__bossR = BOSS.radius;
  gs.events.once('boss-super-returned', () => {
    window.__probe.releasedAt = gs.time.now;
    window.__healing = false;     // from here a hit is allowed to show
    window.__stance = false;      // and he is allowed to answer with offense
    b._reflectUntil = 0;          // the stance ends now, not in 600ms
  });
  await new Promise((r) => setTimeout(r, 400));
}, [gap, pinBoss]);

const teardown = () => page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs.events.off('postupdate', window.__pin);
  gs.events.off('postupdate', window.__sample);
  gs.events.off('player-hurt', window.__hurtFn);
  gs.bossSuperOrbs.getChildren().forEach((o) => o.active && o.kill?.());
  const b = gs.boss;
  b._absorbCount = 0; b._releaseT = 0; b._absorbT = 0;
});

// The real super, fired from the real player, fanned in ORIGIN and aimed at
// him — the stock 30-degree spread misses a boss that is allowed to walk, and
// a partial absorption is a different measurement.
const fireSuper = () => page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { PLAYER } = await import('/src/config.js');
  const b = gs.boss, p = gs.player;
  const half = (PLAYER.superPellets - 1) / 2;
  const front = Math.atan2(b.y - p.y, b.x - p.x) + Math.PI / 2;
  for (let i = 0; i < PLAYER.superPellets; i++) {
    const ox = p.x + Math.cos(front) * (i - half) * 22;
    const oy = p.y + Math.sin(front) * (i - half) * 22;
    gs.playerSuperBullets.fire(ox, oy, Math.atan2(b.y - oy, b.x - ox),
      PLAYER.superSpeed, PLAYER.superDamage * p.dmgMult, PLAYER.superRange,
      { owner: 'player', piercing: true });
  }
});

const waitFor = async (fn, label) => {
  try { await page.waitForFunction(fn, null, { timeout: 30000, polling: 50 }); }
  catch (_) {
    const st = await page.evaluate(() => {
      const gs = window.game.scene.getScene('Game'), b = gs.boss;
      return { alive: b?.alive, hp: Math.round(b?.hp ?? -1),
               absorbCount: b?._absorbCount, releaseT: b?._releaseT,
               guarding: b?.isGuarding?.(), reflectFor: Math.round((b?._reflectUntil ?? 0) - gs.time.now),
               performing: !!b?._performing, state: b?.state,
               bossAt: b ? [Math.round(b.x), Math.round(b.y)] : null,
               playerAt: [Math.round(gs.player.x), Math.round(gs.player.y)],
               superPelletsAlive: gs.playerSuperBullets.getChildren().filter((o) => o.active).length,
               orbs: gs.bossSuperOrbs.getChildren().filter((o) => o.active).length,
               probe: window.__probe };
    });
    console.error(`NEVER REACHED: ${label} — ${JSON.stringify(st)}`);
    await browser.close(); process.exit(1);
  }
};
// ══ CASE 1 — MEDIUM RANGE, VADER FREE TO WALK, CLOCK IN SLOW MOTION ═══════
// Shots 01 and 02: the held state and the compression beat. The compression is
// 110ms of a 620ms window; both are scaled by the same factor so the picture
// is that curve slowed down, not a different one.
console.log('\n== case 1: medium range (820px start), Vader unpinned, slow-motion release ==');
await page.evaluate(async () => {
  const { ENDLESS } = await import('/src/config.js');
  const M = ENDLESS.bossMech;
  window.__real = { rel: M.superReleaseMs, lz: M.superLaunchMs, grace: M.superAbsorbGraceMs };
  M.superAbsorbGraceMs = 2400;
  M.superReleaseMs = 3720;   // 620 x 6
  M.superLaunchMs  = 660;    // 110 x 6, the same ratio
  const b = window.game.scene.getScene('Game').boss;
  if (b._absorbGraceSeen !== undefined) { /* no-op: shape probe only */ }
});
// The slow clock is proved through THE BOSS below, not by reading back the
// constant this rig just wrote: an `import()` from an evaluate can resolve to a
// second module instance under a Vite HMR `?t=` URL, in which case the read-back
// agrees with itself and the game never sees a thing. `_releaseT` is written
// from the boss's own import of the constant, so it is his view of it.
await setup(820, false);
await fireSuper();
await waitFor(() => (window.game.scene.getScene('Game').boss?.heldSuper?.() ?? 0) >= 3,
  'the super is caught');
// SHOVE HIM WHILE HE IS HOLDING IT. The brief asks whether the stored energy
// stays with its holder if Vader moves during the window; he happens to stand
// fairly still while guarding, so waiting for him to wander is waiting for an
// accident. A 140px displacement asks the same question deterministically: an
// attached graphic follows within a frame, an orphaned one is left 140px behind
// and `maxAnchorErr` records it.
await page.evaluate(() => {
  const b = window.game.scene.getScene('Game').boss;
  window.__probe.shoved = true;
  b.setPosition(b.x + 140, b.y + 40);
});
await page.waitForTimeout(150);
await shot('01-held-before-release');
// The held-state question is answered; now give the launch a lane. He closes to
// melee range while holding — which is correct behaviour and exactly why the
// first run photographed no flight at all: he released from ~40px away and the
// orb was on the player inside one frame. Re-staging here happens BEFORE the
// launch beat, so every shot from 02 on is of an unmodified release.
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  window.__bossPin = { x: 800, y: 420 };
  window.__pinBoss = true;
  gs.player.setPosition(800, 1100);       // a 680px lane, ~1.7s of flight
});
await page.waitForTimeout(200);
// Armed HERE, seconds before the launch. Arming it after the release wait is a
// round trip wide, and a flight that ends in a hit can be over inside it — one
// run reported the hook seeing zero orb frames because the orb had lived and
// died between two `page.evaluate` calls.
await armShutter('orb && Math.hypot(orb.x - gs.boss.x, orb.y - gs.boss.y) > 90');
await waitFor(() => (window.game.scene.getScene('Game').boss?._releaseT ?? 0) > 0
                    || window.__probe.releasedAt != null, 'he commits');
const relSeen = await page.evaluate(() => window.game.scene.getScene('Game').boss._releaseT);
if (relSeen > 0 && relSeen < 2000) {
  console.error(`slow clock did not reach the boss: he read superReleaseMs as `
    + `~${Math.round(relSeen)}ms, not ~3720. Restart the dev server so no module `
    + `is served under an HMR ?t= URL, then re-run.`);
  await browser.close(); process.exit(1);
}
// Wait for the window to run down INTO the launch beat, then photograph it.
await waitFor(() => {
  const b = window.game.scene.getScene('Game').boss;
  return (b?._releaseT > 0 && b._releaseT < 560) || window.__probe.releasedAt != null;
}, 'the compression beat');
await shot('02-launch-compression');
await waitFor(() => window.__probe.releasedAt != null, 'the orb leaves');
const gotEarly = await waitShutter('the orb clears him');
if (gotEarly) await shootPaused('03-early-flight',
  'orb && Math.hypot(orb.x - gs.player.x, orb.y - gs.player.y) < 430');
if (gotEarly && await waitShutter('the orb is halfway')) {
  // 230, not 150. Resuming a paused scene hands the next update an oversized
  // delta, so the orb can jump most of a body length in one step — a window
  // narrower than that jump gets stepped straight over, which is how the
  // near-player frame was missed once with the hook reporting zero orb frames.
  await shootPaused('04-mid-flight',
    'orb && Math.hypot(orb.x - gs.player.x, orb.y - gs.player.y) < 230');
  if (await waitShutter('the orb arrives')) await shootPaused('05-near-player');
}
// Let it close on a player who does NOT move, so the near-player frame is a
// real approach rather than a chase.

const held = await page.evaluate(() => window.__probe);
console.log('  held-state probe:', JSON.stringify({
  holdFrames: held.holdFrames, shoved: held.shoved,
  steadyMaxErrPx: Math.round(held.steadyMaxErr),
  errAfterShovePx: held.errAfterShove,
  rawMaxErrPx: Math.round(held.maxAnchorErr),
  bossWalkedPx: Math.round(held.bossWalk),
  minOrbDist: Math.round(held.minOrbDist),
  flightFrames: held.flightFrames, orbEpisodes: held.episodes,
  episodeMs: held.epMs, orbSpeed: held.orbSpeed, orbDamage: held.orbDamage,
  orbRadius: held.orbRadius, orbScaleX: held.orbScaleX,
  maxGhosts: held.maxGhosts, coronaFrames: held.coronaFrames,
  hurts: held.hurts }));

const offense1 = await page.evaluate(() => window.__probe);
console.log('  offense after launch:', JSON.stringify({
  offenseAfterMs: offense1.offenseAfterMs, orbStillFlying: offense1.orbAliveAtOffense,
  flightFrames: offense1.flightFrames }));
await teardown();
await page.evaluate(async () => {
  const { ENDLESS } = await import('/src/config.js');
  Object.assign(ENDLESS.bossMech, { superReleaseMs: window.__real.rel,
    superLaunchMs: window.__real.lz, superAbsorbGraceMs: window.__real.grace });
});

// ══ CASE 2 — MEDIUM RANGE, REAL CLOCK, WALK OUT OF THE WAY ════════════════
console.log('\n== case 2: medium range, real clock, ordinary movement dodge ==');
await setup(460, true);
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs.events.once('boss-super-returned', () => {
    window.__hpAtRelease = gs.player.hp;
    // The sidestep is taken ON the release frame. Taken after a screenshot it
    // arrives ~400ms late, the orb has already landed, and the picture
    // captioned "dodged" is a picture of a hit followed by regeneration.
    window.__walk = () => { gs.player.x += 9; };   // ~180px/s, under PLAYER.speed
    gs.events.on('postupdate', window.__walk);
  });
});
await armClosestShutter();
await fireSuper();
if (await waitShutter('the orb passes them')) await shootPaused('06-dodged-by-walking');
const walk = await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs.events.off('postupdate', window.__walk);
  const pr = window.__probe;
  return { hpAtRelease: window.__hpAtRelease, hp: Math.round(gs.player.hp),
           // The orb deals a flat 455, so "was it the orb?" is answerable from
           // the hurt log rather than from the hp bar.
           hitByOrb: pr.hurts.some((h) => h.amt === 455),
           otherHurts: pr.hurts.filter((h) => h.amt !== 455).map((h) => h.amt),
           closestOrbApproach: Math.round(pr.minOrbDist),
           flightFrames: pr.flightFrames };
});
console.log('  walk dodge:', JSON.stringify(walk));
await teardown();

// ══ CASE 3 — CLOSE RANGE, REAL CLOCK, DASH ════════════════════════════════
console.log('\n== case 3: close range (240px), dash dodge ==');
await page.evaluate(() => { window.__hpAtRelease = null; });
await setup(240, true);
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs.events.once('boss-super-returned', () => {
    window.__hpAtRelease = gs.player.hp;
    const p = gs.player;
    p._moveTargetX = 1; p._moveTargetY = 0;    // lateral, across the orb's lane
    p.tryDash();
    window.__dashed = p.isDashing;
  });
});
await armClosestShutter();
await fireSuper();
if (await waitShutter('the orb passes the dash')) await shootPaused('07-dodged-by-dashing');
const dash = await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  const pr = window.__probe;
  return { dashFired: !!window.__dashed, hpAtRelease: window.__hpAtRelease,
           hp: Math.round(gs.player.hp),
           hitByOrb: pr.hurts.some((h) => h.amt === 455),
           otherHurts: pr.hurts.filter((h) => h.amt !== 455).map((h) => h.amt),
           closestOrbApproach: Math.round(pr.minOrbDist),
           flightFrames: pr.flightFrames };
});
console.log('  dash dodge:', JSON.stringify(dash));
await teardown();

// ══ CASE 4 — STAND STILL AND WEAR IT ══════════════════════════════════════
console.log('\n== case 4: close range, no dodge — the damage is unchanged ==');
await page.evaluate(() => { window.__hpAtRelease = null; window.__hit = null; });
await setup(320, true);
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs.player.hp = gs.player.hpMax = 5000;      // survive it, so the number is readable
  gs.events.once('boss-super-returned', () => { window.__hpAtRelease = gs.player.hp; });
});
await fireSuper();
await waitFor(() => window.__hpAtRelease != null, 'the orb leaves (case 4)');
// The ORB connecting, not merely hp going down — Vader is free to attack after
// the launch and a slam landing first would photograph the wrong thing.
await page.evaluate(() => { window.__pauseOnOrbHit = true; });
await waitFor(() => window.game.scene.getScene('Game').scene.isPaused(), 'the orb connects');
await shootPaused('08-direct-hit');
await page.evaluate(() => { window.__pauseOnOrbHit = false; });
const hit = await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  const pr = window.__probe;
  return { hpAtRelease: window.__hpAtRelease, hp: Math.round(gs.player.hp),
           orbHits: pr.hurts.filter((h) => h.amt === 455).length,
           orbEpisodes: pr.episodes,
           hurts: pr.hurts,
           otherHurts: pr.hurts.filter((h) => h.amt !== 455).map((h) => h.amt) };
});
console.log('  direct hit:', JSON.stringify(hit));
await teardown();

console.log('\n== summary ==');
console.log(JSON.stringify({ flight: held, walk, dash, hit }, null, 1));
await browser.close();
