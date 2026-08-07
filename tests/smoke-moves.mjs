// Nemesis moves: does the ENEMY do something, and does beating it pay?
//
// The previous version of this file passed 20/20 while the feature failed in
// play. It asserted that a telegraph was drawn, that damage landed at commit,
// and that one dash escapes the zone — all true, all irrelevant, because a move
// can satisfy every one of those while the enemy stands perfectly still. The
// player's verdict was "some new circle attacks which don't have animation or
// connection", and no check here could have caught it.
//
// So the two gates that matter now are new:
//
//   MOTION IS MANDATORY  during ACT the actor's position or scale must
//                        measurably change. A move that does not move the
//                        actor is a decal, and fails.
//   BEATING IT PAYS      after a committing move the actor is staggered and
//                        takes bonus damage. Without that the correct play is
//                        to ignore the move and keep shooting, which is what
//                        "they didn't make me move differently" means.
//
// The dodge contract (one 228px dash escapes any zone) is kept from the old
// file — it was the one part that earned its place, catching a 241px cone
// before it shipped.
//
// Harness note, learned the hard way: a live nemesis keeps SHOOTING during a
// probe, and its bolts showed up as a constant 46 damage in three separate
// checks last time. Damage measurements here neutralise the shooter.

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
await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 6161 }));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(1500);

const r = await page.evaluate(async () => {
  const { NEMESIS_MOVES, pickMoves, moveById } = await import('/src/data/nemesisMoves.js');
  const { runMove } = await import('/src/systems/MoveScript.js');
  const { DASH_REACH, Telegraph } = await import('/src/systems/Telegraph.js');
  const { rollNemesis } = await import('/src/data/nemesis.js');
  const { makeRng, makeStreams } = await import('/src/systems/rng.js');
  const gs = window.game.scene.getScene('Game');
  const out = { reach: DASH_REACH, ids: NEMESIS_MOVES.map((m) => m.id) };

  gs.arenaActive = false;
  gs.lives = 9999;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  gs.sector = 12;
  gs.events.emit('set-darkness', false);
  await new Promise((res) => setTimeout(res, 300));

  const spawnCaster = async (traits = ['armored']) => {
    const nem = rollNemesis(12, { traits, base: 'shooter', moves: [], rng: makeRng(3) });
    const e = gs._spawnMiniBoss(nem);
    e._nemesisWeapon = null;         // stop it shooting during measurements
    // Silence the SUMMONER trait's passive pack-spawn (every 7s). It is a
    // separate system from the summoning RITE, and it added five swarmlings
    // mid-measurement — which read as "the interrupted rite still summoned".
    e._summonMs = 0;
    e._regenPerSec = 0;
    e.setPosition(760, 620);
    e.body?.setVelocity(0, 0);
    await new Promise((res) => setTimeout(res, 350));
    return e;
  };

  // ── MOTION IS MANDATORY ───────────────────────────────────────────────
  // For each move: sample the actor before ACT and during ACT. Something about
  // the body has to change, or it is a decal.
  out.motion = [];
  for (const m of NEMESIS_MOVES) {
    gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
    await new Promise((res) => setTimeout(res, 150));
    const e = await spawnCaster();
    gs.player.setPosition(400, 620);
    gs.player.hp = gs.player.hpMax;

    const before = { x: e.x, y: e.y, sx: e.scaleX, sy: e.scaleY, rot: e.weaponSprite?.rotation ?? 0 };
    gs._castNemesisMove(e, m.id);

    // Poll throughout and keep the PEAK stagger, rather than reading it once at
    // the end. A stagger ticks down every frame, so sampling after a fixed wait
    // measures "how much was left when I looked", not "how long a window the
    // move granted" — which read as 128ms for a 550ms window first time round.
    const tAct = (m.anticipateMs ?? 700) + (m.actMs ?? 500) * 0.5;
    const total = tAct + (m.actMs ?? 500) * 0.6 + 400;
    let during = null;
    let peakStagger = 0;
    let peakMult = 1;
    for (let t = 0; t < total; t += 50) {
      await new Promise((res) => setTimeout(res, 50));
      if (during === null && t >= tAct - 60) {
        during = { x: e.x, y: e.y, sx: e.scaleX, sy: e.scaleY, rot: e.weaponSprite?.rotation ?? 0 };
      }
      peakStagger = Math.max(peakStagger, e._staggerMs || 0);
      if (e._punishMs > 0) peakMult = Math.max(peakMult, e._punishMult || 1);
    }
    during = during || { x: e.x, y: e.y, sx: e.scaleX, sy: e.scaleY, rot: e.weaponSprite?.rotation ?? 0 };
    const staggerMs = peakStagger;
    const punishMult = peakMult;

    out.motion.push({
      id: m.id,
      moved: Math.round(Math.hypot(during.x - before.x, during.y - before.y)),
      scaled: Math.abs(during.sx - before.sx) + Math.abs(during.sy - before.sy) > 0.02,
      spun: Math.abs(during.rot - before.rot) > 0.1,
      staggerMs: Math.round(staggerMs),
      punishMult: Number(punishMult.toFixed(2)),
      alive: e.alive,
    });
    gs._destroyEnemyFully(e);
    await new Promise((res) => setTimeout(res, 150));
  }

  // ── BEATING IT PAYS: bonus damage inside the punish window ────────────
  {
    gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
    await new Promise((res) => setTimeout(res, 150));
    const e = await spawnCaster();
    gs.player.setPosition(300, 300);      // far away, so nothing else touches it

    // Baseline: hit it while it is idle.
    const hpA = e.hp;
    e.damage(1000);
    const normal = hpA - e.hp;

    // Now the same hit during a recovery window.
    const m = moveById('baitslam');
    gs._castNemesisMove(e, 'baitslam');
    await new Promise((res) => setTimeout(res, m.anticipateMs + m.actMs + 220));
    const inWindow = e._punishMs > 0;
    const hpB = e.hp;
    e.damage(1000);
    const punished = hpB - e.hp;

    out.punish = { normal: Math.round(normal), punished: Math.round(punished), inWindow };
    gs._destroyEnemyFully(e);
  }

  // ── The interruptible one: shooting is the answer, not dodging ────────
  {
    gs.enemies.getChildren().slice().forEach((x) => gs._destroyEnemyFully(x));
    await new Promise((res) => setTimeout(res, 150));
    const e = await spawnCaster(['summoner']);
    gs.player.setPosition(300, 300);
    const m = moveById('rite');

    const before = gs.enemies.getChildren().filter((x) => x.alive).length;
    gs._castNemesisMove(e, 'rite');
    // Break the channel partway through by dealing real damage.
    await new Promise((res) => setTimeout(res, m.anticipateMs + m.actMs * 0.4));
    e.damage(e.hpMax * 0.12);
    // Peak again, for the same reason — the break grants 1400ms and the old
    // fixed wait sampled it at -42ms, i.e. long after it had expired.
    let brokenStagger = 0;
    for (let t = 0; t < m.actMs + 500; t += 50) {
      await new Promise((res) => setTimeout(res, 50));
      brokenStagger = Math.max(brokenStagger, Math.round(e._staggerMs || 0));
    }
    const afterBroken = gs.enemies.getChildren().filter((x) => x.alive).length;

    // And uninterrupted, it really does summon.
    gs.enemies.getChildren().slice().filter((x) => x !== e).forEach((x) => gs._destroyEnemyFully(x));
    await new Promise((res) => setTimeout(res, 200));
    const before2 = gs.enemies.getChildren().filter((x) => x.alive).length;
    gs._castNemesisMove(e, 'rite');
    await new Promise((res) => setTimeout(res, m.anticipateMs + m.actMs + 500));
    const afterClean = gs.enemies.getChildren().filter((x) => x.alive).length;

    out.rite = {
      interrupted: { before, after: afterBroken, stagger: brokenStagger },
      clean: { before: before2, after: afterClean },
    };
    gs._destroyEnemyFully(e);
  }

  // ── The dodge contract, kept from the old file ────────────────────────
  out.fairness = NEMESIS_MOVES.filter((m) => m.radius || m.laneWidth).map((m) => ({
    id: m.id,
    // circle: worst case is the centre; lane: worst case is the middle line.
    worst: Math.round(m.radius ? m.radius : m.laneWidth / 2),
  }));
  out.windups = NEMESIS_MOVES.map((m) => ({ id: m.id, ms: m.anticipateMs ?? 0 }));

  // ── A move with no ACT is rejected outright ───────────────────────────
  try {
    runMove(gs, { active: true, alive: true, _attachments: [] }, { id: 'bogus' });
    out.decalRejected = false;
  } catch (_) {
    out.decalRejected = true;
  }

  // ── Assignment still seeded and trait-gated ───────────────────────────
  const kit = (seed, traits) => pickMoves(traits, makeStreams(seed, ['nemesis']).nemesis);
  out.assign = {
    a: kit(77, ['armored']).join(','),
    b: kit(77, ['armored']).join(','),
    count: kit(5, ['swift']).length,
    noDupes: new Set(kit(9, ['volatile'])).size === kit(9, ['volatile']).length,
    untraited: kit(11, []).length,
  };

  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  return out;
});

await browser.close();

// ── Motion ───────────────────────────────────────────────────────────────
const still = r.motion.filter((m) => m.moved < 20 && !m.scaled && !m.spun);
check(still.length === 0,
  'every move MOVES the actor during its act beat',
  `${still.map((s) => s.id).join(', ')} did nothing — that is a decal, which is exactly what shipped last time`);
for (const m of r.motion) {
  check(true, `  ${m.id}: travelled ${m.moved}px${m.scaled ? ', scaled' : ''}${m.spun ? ', spun' : ''}, stagger ${m.staggerMs}ms x${m.punishMult}`, '');
}

// ── Punish windows ───────────────────────────────────────────────────────
const noRecovery = r.motion.filter((m) => m.staggerMs < 300);
check(noRecovery.length === 0,
  'every move leaves a recovery window worth punishing',
  `${noRecovery.map((s) => `${s.id} ${s.staggerMs}ms`).join(', ')} — with no recovery the right play is to ignore the move and keep shooting`);
check(r.punish.inWindow, 'the punish window is live right after a slam lands', '');
check(r.punish.punished > r.punish.normal * 1.5,
  'and damage into it really is amplified',
  `${r.punish.normal} idle vs ${r.punish.punished} punished — dodging has to PAY or it is just damage on a timer`);

// ── The interruptible rite ───────────────────────────────────────────────
check(r.rite.interrupted.after <= r.rite.interrupted.before,
  'breaking the summoning rite means nothing is summoned',
  `${r.rite.interrupted.before} -> ${r.rite.interrupted.after}`);
check(r.rite.interrupted.stagger > 800,
  'and it is left badly staggered for answering it with damage',
  `${r.rite.interrupted.stagger}ms — this is the one move whose answer is shooting, not dodging`);
check(r.rite.clean.after > r.rite.clean.before,
  'while an uninterrupted rite really does bring friends',
  `${r.rite.clean.before} -> ${r.rite.clean.after}`);

// ── The dodge contract ───────────────────────────────────────────────────
const unfair = r.fairness.filter((f) => f.worst > r.reach);
check(unfair.length === 0,
  `every zone is escapable by ONE dash (${r.reach}px)`,
  unfair.map((u) => `${u.id} ${u.worst}px`).join(', '));
const tooFast = r.windups.filter((w) => w.ms < 450);
check(tooFast.length === 0, 'every anticipation is long enough to read',
  tooFast.map((w) => `${w.id} ${w.ms}ms`).join(', '));

// ── Structural guard ─────────────────────────────────────────────────────
check(r.decalRejected,
  'a move with no ACT phase is REJECTED, not quietly run',
  'this is the guard against the previous design coming back by accident');

// ── Assignment ───────────────────────────────────────────────────────────
check(r.assign.a === r.assign.b, 'movesets reproducible from a seed', `${r.assign.a} vs ${r.assign.b}`);
check(r.assign.count === 2, 'two moves per nemesis', `${r.assign.count}`);
check(r.assign.noDupes, 'never the same move twice', '');
check(r.assign.untraited === 2, 'an untraited nemesis still gets moves', '');

for (const c of checks) {
  console.log(`  ${c.ok ? 'ok  ' : 'FAIL'}  ${c.label}${c.ok || !c.detail ? '' : ' — ' + c.detail}`);
}
const failed = checks.filter((c) => !c.ok);
if (failed.length) fail(`${failed.length} of ${checks.length} checks failed: ${failed.map((f) => f.label).join('; ')}`);
console.log(`PASS: ${checks.length} checks — the enemy performs the move, and beating it pays`);
