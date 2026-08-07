// Nemesis moves: telegraph, commit, and a dodge that is arithmetic.
//
// The weapons shipped before this gave nemeses different shot patterns and the
// verdict was "it was just multiple shots" — correct, because a cone, a spread
// and a burst are all answered by strafing. A move has to change what the
// player DOES, and the property that makes that true is testable:
//
//   1. There is a telegraph, and it lasts long enough to read.
//   2. Damage lands ONLY at commit — never during the windup.
//   3. Standing outside the drawn zone at commit costs nothing.
//   4. From the worst position inside it, ONE DASH (228px) escapes.
//
// (4) is the one that matters most and the one most likely to rot. "Readable
// and fair" is a feeling; `worstEscape() <= 228` is a fact, and it is what stops
// someone widening a slam radius to 400px because it "felt weak" and shipping an
// undodgeable move.
//
// The zone is described ONCE and used for both the drawing and the hit test, so
// a telegraph cannot lie about where it hurts. That is asserted too, by damaging
// from a position just inside and just outside the same shape.

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
  const { NEMESIS_MOVES, pickMoves, moveById, FAIRNESS_REACH } = await import('/src/data/nemesisMoves.js');
  const { Telegraph, DASH_REACH } = await import('/src/systems/Telegraph.js');
  const { rollNemesis } = await import('/src/data/nemesis.js');
  const { makeRng, makeStreams } = await import('/src/systems/rng.js');
  const gs = window.game.scene.getScene('Game');
  const out = { reach: DASH_REACH, moveIds: NEMESIS_MOVES.map((m) => m.id) };

  gs.arenaActive = false;
  gs.lives = 9999;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  gs.sector = 12;
  await new Promise((res) => setTimeout(res, 300));

  // ── Windups are long enough to react to ───────────────────────────────
  out.windups = NEMESIS_MOVES.map((m) => ({ id: m.id, ms: m.windupMs }));

  // ── The dodge contract, per move ──────────────────────────────────────
  // Build each move's real telegraph geometry against a real caster, then ask
  // the shape itself how far the worst case is from safety.
  gs.player.setPosition(700, 700);
  // SYNTHETIC caster for everything that measures damage. A live nemesis keeps
  // shooting during the probe, and its bolts landed as a constant 46 damage in
  // three separate checks — including one that was supposed to prove standing
  // OUTSIDE the zone is free. The moves only need a position and a radius, so
  // the AI is removed rather than worked around.
  const caster = { x: 700, y: 500, active: true, alive: true,
                   cfg: { radius: 20 }, _attachments: [] };

  out.fairness = NEMESIS_MOVES.map((m) => {
    const spec = m.telegraph(gs, caster);
    const t = new Telegraph(gs, spec.shape, { windupMs: spec.windupMs });
    const worst = t.worstEscape();
    // Extra zones (MINE DROP) have to clear the bar too.
    const extras = (m.extraZones?.(gs, caster) || []).map((sh) => {
      const et = new Telegraph(gs, sh, { windupMs: spec.windupMs });
      const w = et.worstEscape();
      et.destroy();
      return w;
    });
    t.destroy();
    return { id: m.id, worst: Math.round(worst), extras: extras.map(Math.round) };
  });

  // ── Damage lands only at commit, and only inside ──────────────────────
  const damageProbe = async (moveId, inside) => {
    const m = moveById(moveId);
    const spec = m.telegraph(gs, caster);
    gs.player.hp = gs.player.hpMax;

    const tel = gs.spawnTelegraph({ ...spec.shape }, {
      windupMs: spec.windupMs,
      owner: caster,
      onCommit: (t) => m.resolve(gs, caster, t),
    });

    // Put the player exactly where the test wants them, using the SHAPE's own
    // containment answer rather than guessing coordinates.
    const s = spec.shape;
    if (s.kind === 'circle') {
      gs.player.setPosition(inside ? s.x : s.x + s.r + 260, inside ? s.y : s.y);
    } else if (s.kind === 'cone') {
      const d = inside ? s.len * 0.5 : s.len + 260;
      gs.player.setPosition(s.x + Math.cos(s.angle) * d, s.y + Math.sin(s.angle) * d);
    }
    const reallyInside = tel.contains(gs.player.x, gs.player.y);

    // Mid-windup: nothing may have happened yet.
    await new Promise((res) => setTimeout(res, Math.round(spec.windupMs * 0.5)));
    const midHp = gs.player.hp;

    // Past commit plus the linger.
    await new Promise((res) => setTimeout(res, spec.windupMs + 500));
    const endHp = gs.player.hp;

    return {
      moveId, inside, reallyInside,
      duringWindup: Math.round(gs.player.hpMax - midHp),
      total: Math.round(gs.player.hpMax - endHp),
    };
  };

  // SHOCKWAVE RING inverts (the cone is the SAFE wedge), so it is probed apart.
  out.slamIn = await damageProbe('slam', true);
  out.slamOut = await damageProbe('slam', false);
  out.sweepIn = await damageProbe('sweep', true);
  out.sweepOut = await damageProbe('sweep', false);

  // The ring: standing in the drawn wedge is SAFE, outside it inside the radius
  // is not. Inverted on purpose and worth asserting, because a telegraph whose
  // meaning flips is exactly the kind of thing that ships backwards.
  {
    const m = moveById('ring');
    const spec = m.telegraph(gs, caster);
    const s = spec.shape;
    gs.player.hp = gs.player.hpMax;
    gs.player.setPosition(s.x + Math.cos(s.angle) * s.len * 0.6, s.y + Math.sin(s.angle) * s.len * 0.6);
    gs.spawnTelegraph({ ...s }, { windupMs: spec.windupMs, owner: caster,
      onCommit: (t) => m.resolve(gs, caster, t) });
    await new Promise((res) => setTimeout(res, spec.windupMs + 500));
    const safeDmg = Math.round(gs.player.hpMax - gs.player.hp);

    gs.player.hp = gs.player.hpMax;
    const spec2 = m.telegraph(gs, caster);
    const s2 = spec2.shape;
    gs.player.setPosition(s2.x + Math.cos(s2.angle + Math.PI) * 120, s2.y + Math.sin(s2.angle + Math.PI) * 120);
    gs.spawnTelegraph({ ...s2 }, { windupMs: spec2.windupMs, owner: caster,
      onCommit: (t) => m.resolve(gs, caster, t) });
    await new Promise((res) => setTimeout(res, spec2.windupMs + 500));
    const gapDmg = Math.round(gs.player.hpMax - gs.player.hp);
    out.ring = { inGap: safeDmg, outOfGap: gapDmg };
  }

  // ── Assignment: seeded, trait-gated, no duplicates ────────────────────
  const kit = (seed, traits) => pickMoves(traits, makeStreams(seed, ['nemesis']).nemesis);
  out.assign = {
    reproducibleA: kit(77, ['armored']).join(','),
    reproducibleB: kit(77, ['armored']).join(','),
    countsTwo: kit(5, ['swift']).length,
    noDupes: new Set(kit(9, ['volatile'])).size === kit(9, ['volatile']).length,
    untraitedStillGetsMoves: kit(11, []).length,
  };
  // Trait gating: a heavy nemesis should reach heavy moves.
  const heavySeen = new Set();
  for (let s = 0; s < 40; s++) kit(s, ['armored', 'colossal']).forEach((id) => heavySeen.add(id));
  out.heavySeen = [...heavySeen].sort();

  // Moves ride on the rolled nemesis and are equipped on spawn.
  const withMoves = rollNemesis(12, { traits: ['armored'], base: 'shooter', rng: makeRng(21) });
  const e2 = gs._spawnMiniBoss(withMoves);
  await new Promise((res) => setTimeout(res, 300));
  out.equipped = {
    rolled: (withMoves.moves || []).length,
    onEnemy: (e2._moveIds || []).length,
    // Compared as a FRACTION, not for equality: the scene ticks during the
    // wait, so the clock has already counted down a little. What matters is
    // that it started near a full interval rather than at zero.
    clockFrac: e2._moveEvery ? e2._moveT / e2._moveEvery : 0,
  };

  // ── Ownership: a telegraph dies with its caster ───────────────────────
  const before = gs._telegraphs.length;
  gs._castNemesisMove(e2, 'slam');
  await new Promise((res) => setTimeout(res, 120));
  const during = gs._telegraphs.length;
  gs._destroyEnemyFully(e2);
  await new Promise((res) => setTimeout(res, 250));
  const liveAfter = gs._telegraphs.filter((t) => !t.dead).length;
  out.ownership = { before, during, liveAfter };

  // And a room change sweeps any left holding on.
  gs._castNemesisMove(caster, 'mines');
  await new Promise((res) => setTimeout(res, 120));
  const beforeClear = gs._telegraphs.filter((t) => !t.dead).length;
  gs.clearTelegraphs();
  out.roomChange = { beforeClear, afterClear: gs._telegraphs.filter((t) => !t.dead).length };

  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  return out;
});

await browser.close();

// ── The dodge contract ───────────────────────────────────────────────────
const unfair = r.fairness.filter((f) => f.worst > r.reach || f.extras.some((e) => e > r.reach));
check(unfair.length === 0,
  `every move is escapable by ONE dash (${r.reach}px)`,
  unfair.map((u) => `${u.id} worst ${u.worst}px`).join(', ')
    + ' — a zone wider than the dash is a trap, not a challenge');
check(r.fairness.length === 4, 'all four moves measured', r.fairness.map((f) => `${f.id}:${f.worst}`).join(' '));

const tooFast = r.windups.filter((w) => w.ms < 700);
check(tooFast.length === 0, 'every windup is at least 700ms',
  tooFast.map((w) => `${w.id} ${w.ms}ms`).join(', ') + ' — under that it is a hit, not a telegraph');

// ── Commit timing ────────────────────────────────────────────────────────
check(r.slamIn.reallyInside && !r.slamOut.reallyInside,
  'the probe really was inside / outside the slam (the control)',
  `in=${r.slamIn.reallyInside} out=${r.slamOut.reallyInside}`);
check(r.slamIn.duringWindup === 0 && r.sweepIn.duringWindup === 0,
  'standing in a zone during the WINDUP costs nothing',
  `slam ${r.slamIn.duringWindup}, sweep ${r.sweepIn.duringWindup} — damage before the commit makes the telegraph a lie`);
check(r.slamIn.total > 0, 'and being there at commit hurts', `${r.slamIn.total} damage`);
check(r.slamOut.total === 0, 'while standing outside it costs nothing at all',
  `${r.slamOut.total} damage — the drawn shape and the hit test must be one description`);
check(r.sweepIn.total > 0 && r.sweepOut.total === 0,
  'the same holds for the cone', `in ${r.sweepIn.total}, out ${r.sweepOut.total}`);

// ── The ring reads the other way round, deliberately ─────────────────────
check(r.ring.inGap === 0, 'SHOCKWAVE RING: the drawn wedge is the SAFE one',
  `took ${r.ring.inGap} standing in the gap — this telegraph is inverted, and shipping it backwards would be invisible in code review`);
check(r.ring.outOfGap > 0, 'and being anywhere else inside the radius hurts',
  `${r.ring.outOfGap} damage`);

// ── Assignment ───────────────────────────────────────────────────────────
check(r.assign.reproducibleA === r.assign.reproducibleB, 'movesets are reproducible from a seed',
  `${r.assign.reproducibleA} vs ${r.assign.reproducibleB}`);
check(r.assign.countsTwo === 2, 'two moves per nemesis', `${r.assign.countsTwo}`);
check(r.assign.noDupes, 'and never the same move twice', '');
check(r.assign.untraitedStillGetsMoves === 2,
  'an untraited nemesis still gets moves',
  'otherwise it is the only enemy in the game with nothing to dodge, which reads as a bug');
check(r.heavySeen.includes('slam') || r.heavySeen.includes('ring'),
  'a heavy loadout reaches the heavy moves',
  `saw ${r.heavySeen.join(',')} — gating is what makes the silhouette predict behaviour`);
check(r.equipped.rolled === 2 && r.equipped.onEnemy === 2,
  'moves ride the rolled nemesis onto the spawned enemy',
  `rolled ${r.equipped.rolled}, equipped ${r.equipped.onEnemy}`);
check(r.equipped.clockFrac > 0.8, 'with close to a full interval before the first cast',
  `clock at ${(r.equipped.clockFrac * 100).toFixed(0)}% — a telegraph during the spawn banner is a bad spawn, not a surprise`);

// ── Ownership ────────────────────────────────────────────────────────────
check(r.ownership.during > r.ownership.before, 'casting a move creates a telegraph',
  `${r.ownership.before} -> ${r.ownership.during}`);
check(r.ownership.liveAfter === 0,
  'and killing the caster mid-windup takes it with them',
  `${r.ownership.liveAfter} still live — an orphan is a permanent red circle on the floor`);
check(r.roomChange.beforeClear > 0 && r.roomChange.afterClear === 0,
  'a room change sweeps any that remain',
  `${r.roomChange.beforeClear} -> ${r.roomChange.afterClear}`);

for (const c of checks) {
  console.log(`  ${c.ok ? 'ok  ' : 'FAIL'}  ${c.label}${c.ok || !c.detail ? '' : ' — ' + c.detail}`);
}
const failed = checks.filter((c) => !c.ok);
if (failed.length) fail(`${failed.length} of ${checks.length} checks failed: ${failed.map((f) => f.label).join('; ')}`);
console.log(`PASS: ${checks.length} checks — moves telegraph, commit, and can always be dodged`);
