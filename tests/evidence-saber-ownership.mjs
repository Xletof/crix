// EVIDENCE RIG — one saber, one owner.
//
// Handset footage at ~26-29s: Vader threw his lightsaber, the DEFLECTION clock
// came due while the blade was still in the air, the guard opened anyway, and
// he parried bolts with a weapon that was several hundred pixels away. This rig
// photographs both directions of the fix in the running game:
//
//   CASE A  throw first  — the blade leaves, DEFLECTION comes due, nothing is
//                          announced, bolts LAND on him, the blade comes home,
//                          and only then does the tell go up and the guard open.
//   CASE B  guard first  — the stance is up, SABER THROW is refused for as long
//                          as it owns the blade, and becomes available again the
//                          moment it drops.
//
// Nothing here is faked: possession is `_saberAway`, which the throw itself
// sets when it detaches `weaponSprite` and flies it across the room, and every
// bolt is a real player bolt through the real collision path. Sprite visibility
// is never touched — an invisible saber is still a saber he is holding.
//
//   node tests/evidence-saber-ownership.mjs [outDir]

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';

const OUT = process.argv[2] || 'shots-saber';
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

// ── THE SHUTTER LIVES INSIDE THE GAME ────────────────────────────────────
// Same reason as `evidence-superorb`: a `page.evaluate` round trip costs
// 200-400ms, and the beats here (the catch, the tell) are one frame each.
const armShutter = (cond) => page.evaluate((src) => {
  const gs = window.game.scene.getScene('Game');
  const test = new Function('gs', 'b', `return (${src});`);
  window.__shutterFrames = 0;
  window.__shutter = () => {
    window.__shutterFrames++;
    let hit = false;
    try { hit = !!test(gs, gs.boss); } catch (_) { hit = false; }
    if (hit) { gs.events.off('postupdate', window.__shutter); gs.scene.pause(); }
  };
  gs.events.on('postupdate', window.__shutter);
}, cond);

const waitShutter = async (label) => {
  try {
    await page.waitForFunction(() => window.game.scene.getScene('Game').scene.isPaused(),
      null, { timeout: 20000, polling: 40 });
    return true;
  } catch (_) {
    const d = await page.evaluate(() => {
      const gs = window.game.scene.getScene('Game');
      gs.events.off('postupdate', window.__shutter);
      return { frames: window.__shutterFrames, saberAway: !!gs.boss?._saberAway,
               pending: !!gs.boss?._reflectPending, claimed: !!gs.boss?._reflectClaimed,
               reflecting: !!gs.boss?.isReflecting?.() };
    });
    console.error(`SHUTTER NEVER FIRED: ${label} — ${JSON.stringify(d)}`);
    return false;
  }
};

const shootPaused = async (name, nextCond) => {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`  ${OUT}/${name}.png`);
  if (nextCond) await armShutter(nextCond);
  await page.evaluate(() => window.game.scene.getScene('Game').scene.resume());
};

// Stage the pair, arm DEFLECTION on its REAL clock, and start recording. The
// bug lived in the scheduler, so the scheduler is what has to run — nothing
// here writes `_reflectUntil` by hand.
const stage = () => page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const b = gs.boss, p = gs.player;
  const { ENDLESS } = await import('/src/config.js');
  const M = ENDLESS.bossMech;
  gs.arenaActive = false; gs.lives = 9999;
  gs.enemies.getChildren().slice().forEach((e) => { if (e.alive) gs._destroyEnemyFully(e); });
  p.setPosition(800, 1100); p.setVelocity(0, 0);
  b.setPosition(800, 500); b.setVelocity(0, 0);
  b._reflectUntil = 0; b._reflectPending = false; b._reflectClaimed = false;
  b._absorbCount = 0; b._releaseT = 0; b._absorbT = 0; b._releaseN = 0;
  b.state = 'idle'; b._activeMove = null; b._performing = false;
  b._reflectEvery = M.reflectEveryMs;
  b._reflectT = M.reflectEveryMs;
  b._blackoutEvery = 0; b._afterimageEvery = 0; b._disarmEvery = 0;

  window.__log = [];
  window.__ev = { windup: [], open: [] };
  window.__onW = () => window.__ev.windup.push({ t: Math.round(gs.time.now),
    away: !!b._saberAway, saberPx: b.weaponSprite
      ? Math.round(Math.hypot(b.weaponSprite.x - b.x, b.weaponSprite.y - b.y)) : -1 });
  window.__onO = () => window.__ev.open.push({ t: Math.round(gs.time.now), away: !!b._saberAway });
  gs.events.on('boss-reflect-windup', window.__onW);
  gs.events.on('boss-reflect-open', window.__onO);

  window.__deflected = 0;
  window.__realFire = gs.deflectedBullets.fire.bind(gs.deflectedBullets);
  gs.deflectedBullets.fire = (...a) => { window.__deflected++; return window.__realFire(...a); };

  window.__probe = { awayFrames: 0, pendingAway: 0, reflectAway: 0, guardAway: 0,
                     maxSaberPx: 0, sabers: 0, caughtAt: -1, sawAway: 0,
                     bossHpAtBolts: null, hits: [] };
  window.__hurt = null;
  window.__sample = () => {
    const pr = window.__probe, ws = b.weaponSprite;
    // The player is kept alive but NOT healed: what hits Vader is the point.
    gs.lives = 9999; p.alive = true;
    if (b._saberAway) {
      pr.sawAway = 1; pr.awayFrames++;
      if (b._reflectPending) pr.pendingAway++;
      if (b.isReflecting()) pr.reflectAway++;
      if (b.isGuarding?.()) pr.guardAway++;
      if (ws?.active) pr.maxSaberPx = Math.max(pr.maxSaberPx,
        Math.round(Math.hypot(ws.x - b.x, ws.y - b.y)));
    } else if (pr.sawAway && pr.caughtAt < 0) {
      pr.caughtAt = Math.round(gs.time.now);
    }
    pr.sabers = Math.max(pr.sabers, gs.children.list.filter(
      (o) => o.texture?.key === 'wpn-saber' && o.active && o.visible).length);
  };
  gs.events.on('postupdate', window.__sample);
  await new Promise((r) => setTimeout(r, 300));
});

// A real player bolt from a flank, so a parry would be unmistakable.
const shoot = () => page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  const b = gs.boss, p = gs.player;
  const a = Math.atan2(p.y - b.y, p.x - b.x) + Math.PI / 2;
  gs.playerBullets.fire(b.x + Math.cos(a) * 110, b.y + Math.sin(a) * 110,
    a + Math.PI, 880, 300, 900, { owner: 'player' });
});

const state = () => page.evaluate(() => {
  const gs = window.game.scene.getScene('Game'), b = gs.boss;
  const ws = b.weaponSprite;
  return {
    saberAway: !!b._saberAway,
    saberPx: ws?.active ? Math.round(Math.hypot(ws.x - b.x, ws.y - b.y)) : -1,
    hasSaber: b.hasSaber ? b.hasSaber() : null,
    pending: !!b._reflectPending, claimed: !!b._reflectClaimed,
    reflecting: !!b.isReflecting?.(), guarding: !!b.isGuarding?.(),
    bossHp: Math.round(b.hp), deflected: window.__deflected,
    t: Math.round(gs.time.now),
  };
});

// ══ CASE A — THROW FIRST ═════════════════════════════════════════════════
//
// EVERYTHING THAT HAS TO HAPPEN WHILE THE BLADE IS AWAY HAPPENS INSIDE THE
// GAME. The first version of this case made DEFLECTION due and fired its bolts
// from Node, and by the time those round trips landed the blade was already
// back in his hand — it photographed a perfectly ordinary armed parry and
// reported it as the unarmed case. The whole window is ~1.5s of game time and a
// `page.evaluate` costs 200-400ms, so an aggressor hook does the work on the
// frames it belongs on and Node only reads the record afterwards.
console.log('\n== case A: SABER THROW owns the blade, DEFLECTION waits ==');
await stage();
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game'), b = gs.boss, p = gs.player;
  window.__cast = gs._castBossMove(b, 'saberthrow') ? 1 : 0;
  window.__caseA = { dueAt: -1, hpAtDue: -1, hpAtCatch: -1, bolts: 0,
                     boltFrames: [], sawFar: 0 };
  let cool = 0;
  window.__aggro = () => {
    const A = window.__caseA, ws = b.weaponSprite;
    if (!b._saberAway) return;
    const far = ws?.active ? Math.hypot(ws.x - b.x, ws.y - b.y) : 0;
    A.sawFar = Math.max(A.sawFar, Math.round(far));
    // The clock comes due with the blade genuinely gone, not merely detaching.
    // 120px, not 200: his rest offset is ~50px, so 120 is already unambiguously
    // "not in his hand", and the whole unarmed window is only a handful of
    // frames in this harness. Waiting for 200 spent most of it.
    if (A.dueAt < 0 && far > 120) {
      A.dueAt = Math.round(gs.time.now);
      A.hpAtDue = Math.round(b.hp);
      b._reflectT = 1;
    }
    if (A.dueAt < 0) return;
    // Three real bolts from a flank, a few frames apart, all of them while he
    // is unarmed. A parry here would be a weapon several hundred pixels away
    // batting a bolt out of the air.
    if (cool > 0) { cool--; return; }
    if (A.bolts >= 3) return;
    const ang = Math.atan2(p.y - b.y, p.x - b.x) + Math.PI / 2;
    gs.playerBullets.fire(b.x + Math.cos(ang) * 110, b.y + Math.sin(ang) * 110,
      ang + Math.PI, 880, 300, 900, { owner: 'player' });
    A.bolts++; A.boltFrames.push(Math.round(gs.time.now)); cool = 1;
  };
  gs.events.on('postupdate', window.__aggro);
});

// The money frame: unarmed, and DEFLECTION owed. On 98da03f this state does not
// exist — the tell had already gone up and the guard was opening.
await armShutter('b._saberAway && b._reflectPending');
if (await waitShutter('unarmed, with the deflection owed')) {
  await shootPaused('a1-owed-while-unarmed',
    'b._saberAway && gs.playerBullets.getChildren().some((x) => x.active '
    + '&& Math.hypot(x.x - b.x, x.y - b.y) < 130)');
  if (await waitShutter('a bolt reaching the unarmed Vader')) {
    await shootPaused('a2-bolt-vs-unarmed', '!b._saberAway');
    if (await waitShutter('the catch')) {
      await page.evaluate(() => {
        const gs = window.game.scene.getScene('Game');
        window.__caseA.hpAtCatch = Math.round(gs.boss.hp);
      });
      await shootPaused('a3-caught', 'b._reflectClaimed');
      if (await waitShutter('the deferred tell')) {
        await shootPaused('a4-tell-after-catch', 'b.isReflecting()');
        if (await waitShutter('the guard opens')) await shootPaused('a5-guard-open');
      }
    }
  }
}
await page.evaluate(() => {
  window.game.scene.getScene('Game').events.off('postupdate', window.__aggro);
});
const afterA = await state();
const evA = await page.evaluate(() => ({ ...window.__ev, probe: window.__probe,
                                         caseA: window.__caseA, cast: window.__cast }));
console.log('  throw cast:', evA.cast, ' blade reached',
  evA.caseA.sawFar + 'px from his hand');
console.log('  while unarmed:', JSON.stringify({
  dueAt: evA.caseA.dueAt, boltsFired: evA.caseA.bolts, boltAt: evA.caseA.boltFrames,
  bossHpAtDue: evA.caseA.hpAtDue, bossHpAtCatch: evA.caseA.hpAtCatch,
  hpTakenWhileUnarmed: evA.caseA.hpAtDue - evA.caseA.hpAtCatch,
  boltsParried: afterA.deflected,
  awayFrames: evA.probe.awayFrames, pendingWhileAway: evA.probe.pendingAway,
  reflectingWhileAway: evA.probe.reflectAway, guardingWhileAway: evA.probe.guardAway,
  liveSaberSprites: evA.probe.sabers,
}));
console.log('  handoff:', JSON.stringify({
  caughtAt: evA.probe.caughtAt, windup: evA.windup, open: evA.open,
  tellAfterCatchMs: evA.windup[0] ? evA.windup[0].t - evA.probe.caughtAt : null,
  deferredMs: evA.windup[0] ? evA.windup[0].t - evA.caseA.dueAt : null,
}));

// The recovered stance really does parry.
//
// The window has to be re-opened first, and that is a RIG repair, not a fake:
// Phaser's clock keeps advancing while a scene is paused, and the five
// screenshots above pause it for tens of seconds of `time.now` — so by the time
// Node gets here the 2400ms stance that genuinely opened at a5 has long since
// expired on a clock that never ran. Nothing about possession is touched; the
// blade is in his hand and `hasSaber()` is true either way. The unpaused
// version of this claim is `smoke-deflect`'s `parriedAfterReturn`.
const parry = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game'), b = gs.boss, p = gs.player;
  const before = window.__deflected;
  const hadSaber = b.hasSaber ? b.hasSaber() : null;
  b._reflectUntil = gs.time.now + 3000;
  let n = 0, cool = 0;
  const fire = () => {
    if (cool-- > 0 || n >= 3) return;
    const a = Math.atan2(p.y - b.y, p.x - b.x) + Math.PI / 2;
    gs.playerBullets.fire(b.x + Math.cos(a) * 110, b.y + Math.sin(a) * 110,
      a + Math.PI, 880, 300, 900, { owner: 'player' });
    n++; cool = 2;
  };
  gs.events.on('postupdate', fire);
  await new Promise((r) => setTimeout(r, 1400));
  gs.events.off('postupdate', fire);
  return { hadSaber, boltsFired: n, parried: window.__deflected - before };
});
console.log('  the recovered stance parries:', JSON.stringify(parry));
const afterParry = await state();

// ══ CASE B — DEFLECTION FIRST ════════════════════════════════════════════
console.log('\n== case B: the stance owns the blade, SABER THROW waits ==');
const caseB = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game'), b = gs.boss, p = gs.player;
  p.alive = true; p.hp = p.hpMax; gs.lives = 9999;
  // START FROM A BLADE IN HIS HAND. His own move clock is still running, and a
  // first version of this case read `_saberAway` true 250ms into the guard —
  // from a throw he had legitimately started BEFORE the stance went up, which
  // is allowed and says nothing about the case under test. Anything in flight
  // is cancelled and the starting state is recorded rather than assumed.
  const h0 = b._activeMove;
  if (h0?.move?.onCancel) { try { h0.move.onCancel(gs, b, h0.h || {}); } catch (_) {} }
  if (b._activeMove) b._activeMove.phase = 'done';
  b._saberAway = false; b._noMelee = false;
  if (b.weaponSprite?.active) { b.weaponSprite.x = b.x; b.weaponSprite.y = b.y; }
  b.state = 'idle'; b._activeMove = null; b._performing = false;
  const awayBefore = !!b._saberAway;
  const hasSaberBefore = b.hasSaber ? b.hasSaber() : null;
  b._reflectUntil = gs.time.now + 2500;
  const during = gs._castBossMove(b, 'saberthrow') ? 1 : 0;
  await new Promise((r) => setTimeout(r, 250));
  const awayDuring = !!b._saberAway;
  const endedAt = gs.time.now;
  b._reflectUntil = 0; b._reflectClaimed = false;
  b.state = 'idle'; b._activeMove = null; b._performing = false;
  const after = gs._castBossMove(b, 'saberthrow') ? 1 : 0;
  const gapMs = Math.round(gs.time.now - endedAt);
  return { awayBefore, hasSaberBefore, castDuringGuard: during,
           saberAwayDuringGuard: awayDuring, castAfterGuard: after, gapMs };
});
await page.waitForTimeout(120);
await page.evaluate(() => window.game.scene.getScene('Game').scene.pause());
await page.screenshot({ path: `${OUT}/b1-throw-after-guard.png` });
console.log(`  ${OUT}/b1-throw-after-guard.png`);
await page.evaluate(() => window.game.scene.getScene('Game').scene.resume());
console.log('  ', JSON.stringify(caseB));

await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game'), b = gs.boss;
  gs.events.off('postupdate', window.__sample);
  gs.events.off('boss-reflect-windup', window.__onW);
  gs.events.off('boss-reflect-open', window.__onO);
  gs.deflectedBullets.fire = window.__realFire;
  const h = b._activeMove;
  if (h?.move?.onCancel) { try { h.move.onCancel(gs, b, h.h || {}); } catch (_) {} }
  if (b._activeMove) b._activeMove.phase = 'done';
  b._saberAway = false; b._noMelee = false; b._performing = false; b.state = 'idle';
  b._reflectEvery = 0; b._reflectUntil = 0;
  b._reflectPending = false; b._reflectClaimed = false;
});

console.log('\n== summary ==');
console.log(JSON.stringify({ caseA: { ...afterA, ...evA.probe, windup: evA.windup,
  open: evA.open }, caseB }, null, 1));
await browser.close();
