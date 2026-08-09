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

// `?nodlg=1` mutes the dialogue cards. They pause Game and HUD and wait for a
// tap, which hangs a bot for the whole measurement cap — see systems/debug.js.
const URL = 'http://localhost:5173/?nodlg=1';
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
    // Silence its OWN move clock. `_castNemesisMove` refuses while a move is
    // running and returns null, and a refused cast reads exactly like a move
    // that granted no stagger — which is what "charge 0ms, blink 0ms" was.
    e._moveIds = [];
    e._activeMove = null;
    e.setPosition(760, 620);
    e.body?.setVelocity(0, 0);
    // Generous: a freshly spawned mini-boss is not `active` for its whole
    // spawn-in, and `runMove`'s beat timers no-op while it is not. At 350ms the
    // FIRST caster of the run was still materialising, so its anticipate timer
    // silently dropped and the move never left beat one.
    await new Promise((res) => setTimeout(res, 900));
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

    // Sample on the game's OWN frame. tests/README.md says this outright and the
    // first version of this block ignored it: a stagger ticks DOWN every frame,
    // so an async poll at 50ms in a ~50ms/frame harness lands wherever it lands
    // and reports "how much was left when I looked", not "how big a window the
    // move granted". A 550ms window read as 128ms that way, and the check
    // failed intermittently on nothing but scheduler jitter afterwards.
    // The postupdate hook cannot miss a frame, so the peak is the real peak.
    const peak = { moved: 0, scale: 0, spin: 0, stagger: 0, mult: 1 };
    const onFrame = () => {
      peak.moved = Math.max(peak.moved, Math.hypot(e.x - before.x, e.y - before.y));
      peak.scale = Math.max(peak.scale, Math.abs(e.scaleX - before.sx) + Math.abs(e.scaleY - before.sy));
      peak.spin = Math.max(peak.spin, Math.abs((e.weaponSprite?.rotation ?? 0) - before.rot));
      peak.stagger = Math.max(peak.stagger, e._staggerMs || 0);
      if (e._punishMs > 0) peak.mult = Math.max(peak.mult, e._punishMult || 1);
    };
    gs.events.on('postupdate', onFrame);
    gs.player.alive = true;
    const handle = gs._castNemesisMove(e, m.id);
    const cast = !!handle;
    const phases = [];
    if (handle) { const ph = () => { if (phases[phases.length - 1] !== handle.phase) phases.push(handle.phase); }; onFrame.ph = ph; gs.events.on('postupdate', ph); }

    // Wait for the MOVE to finish, not for a wall-clock duration. The scene's
    // clock is not wall time here: at ~20 FPS with delta capping, the game
    // advances measurably slower than the wall, and the very first cast of a
    // run is the worst of it — charge's 800ms anticipate timer sat at 55%
    // progress after 2.4s of real time, so a "generous" fixed wait ended while
    // the move was still on beat one. That read as "charge grants no recovery",
    // which was a lie about the game told by the instrument.
    for (let i = 0; i < 200 && handle && handle.phase !== 'done'; i++) {
      await new Promise((res) => setTimeout(res, 50));
    }
    gs.events.off('postupdate', onFrame);
    if (onFrame.ph) gs.events.off('postupdate', onFrame.ph);

    out.motion.push({
      phases: phases.join('>'), cancelled: handle?.cancelled ?? null, cast,
      id: m.id,
      moved: Math.round(peak.moved),
      scaled: peak.scale > 0.02,
      spun: peak.spin > 0.1,
      staggerMs: Math.round(peak.stagger),
      punishMult: Number(peak.mult.toFixed(2)),
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
    gs.player.alive = true;
    e._activeMove = null;
    out.punishCast = !!gs._castNemesisMove(e, 'baitslam');
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
    // Same frame-hook sampling as above: the break grants 1400ms and an async
    // poll sampled it at -42ms, i.e. long after it had expired.
    let brokenStagger = 0;
    const onFrame = () => { brokenStagger = Math.max(brokenStagger, e._staggerMs || 0); };
    gs.events.on('postupdate', onFrame);
    gs.player.alive = true;
    e._activeMove = null;
    gs._castNemesisMove(e, 'rite');
    // Break the channel partway through by dealing real damage.
    await new Promise((res) => setTimeout(res, m.anticipateMs + m.actMs * 0.4));
    e.damage(e.hpMax * 0.12);
    await new Promise((res) => setTimeout(res, m.actMs + 500));
    gs.events.off('postupdate', onFrame);
    brokenStagger = Math.round(brokenStagger);
    const afterBroken = gs.enemies.getChildren().filter((x) => x.alive).length;

    // And uninterrupted, it really does summon.
    gs.enemies.getChildren().slice().filter((x) => x !== e).forEach((x) => gs._destroyEnemyFully(x));
    await new Promise((res) => setTimeout(res, 200));
    const before2 = gs.enemies.getChildren().filter((x) => x.alive).length;
    e._activeMove = null;
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
  check(true, `  ${m.id}: travelled ${m.moved}px${m.scaled ? ', scaled' : ''}${m.spun ? ', spun' : ''}, stagger ${m.staggerMs}ms x${m.punishMult} [${m.phases}${m.cancelled ? ' CANCELLED' : ''}]`, '');
}

// A refused cast (`_castNemesisMove` returns null while another move is live)
// looks EXACTLY like a move that granted nothing, and that is what three of
// these checks were actually failing on.
const notCast = r.motion.filter((m) => !m.cast || !m.phases.includes('recover'));
check(notCast.length === 0,
  'every move under test actually RAN all four beats',
  `${notCast.map((m) => `${m.id} [${m.phases || 'refused'}]`).join(', ')}`);
check(r.punishCast, 'and so did the one used for the punish measurement', '');

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
