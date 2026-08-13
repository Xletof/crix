// Is a nemesis encounter actually a DUEL?
//
// ── Why this exists ───────────────────────────────────────────────────────
//
// The verdict on the previous build was that nemeses were "the same as normal
// enemies but just enlarged". Three measured causes, one gate each:
//
//   1. THE BOMBER DELETED ITSELF. `EnemyBomber._detonate()` sets hp = 0 and
//      calls die(), and `bomber` is a legal nemesis base. A body carrying 6x
//      hp, traits, regalia, a generated name and a ledger grudge ended its own
//      fight by walking into the player, so its entire hp pool was unreachable.
//      This is the single loudest symptom and the cheapest to regress: anyone
//      touching EnemyBomber can put it back without noticing.
//
//   2. THERE WAS NO ENCOUNTER. The nemesis was one more wave member, with the
//      trash drip continuing around it. A telegraph is a promise about which
//      patch of floor is about to hurt, and it cannot keep that promise through
//      a crowd — so every curated move built on top of it is wasted.
//
//   3. NOTHING SAID IT WAS A FIGHT. No health bar, no phases. A 30-second body
//      with no visible progress reads as a damage sponge rather than a boss.
//
// A/B: every check here was run against the pre-change build and fails there.
// Check 1 in particular is the direct regression gate on the reported bug.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

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
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

await page.goto(URL);
await page.waitForTimeout(4500);
await page.mouse.click(360, 640);
await page.waitForTimeout(800);
await page.evaluate(() => window.game.scene.getScene('Title')
  .scene.start('Game', { mode: 'endless', seed: 20260813 }));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(1500);

// ── 1. The bomber nemesis must survive touching the player ────────────────
//
// Deliberately NOT run with the move clock silenced. The post-mortem rule is
// that a behaviour is never verified with the system it shares an actor with
// switched off — a bomber whose kit is disabled is not the bomber that ships.
const bomber = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { ROOMS } = await import('/src/data/rooms.js');
  const { setGodMode } = await import('/src/systems/debug.js');
  const { rollNemesis } = await import('/src/data/nemesis.js');
  setGodMode(true);                     // the player's survival is not the measurement
  gs.loadRoom(ROOMS[0]);
  await new Promise((r) => setTimeout(r, 1500));
  gs.enemies.getChildren().slice().forEach((x) => gs._destroyEnemyFully(x));
  await new Promise((r) => setTimeout(r, 300));

  const nem = rollNemesis(3, { rng: gs.rng.nemesis, base: 'bomber', traits: [] });
  const e = gs._spawnMiniBoss(nem);
  await new Promise((r) => setTimeout(r, 400));
  const hp0 = e.hp;
  const hpMax = e.hpMax;

  // Walk it onto the player: park the player next to it and let its own AI
  // close the last few pixels, so the real contact path runs.
  gs.player.setPosition(e.x + 40, e.y);
  let touched = 0;
  const t0 = performance.now();
  while (performance.now() - t0 < 6000) {
    gs.player.setPosition(e.x + 30, e.y);
    if (Math.hypot(gs.player.x - e.x, gs.player.y - e.y) <= 60) touched++;
    await new Promise((r) => setTimeout(r, 50));
  }
  return {
    hpMax, hp0, hpAfter: e.hp, alive: !!e.alive, active: !!e.active, touched,
    detonated: !!e._detonated,
  };
});

// ── 2. A duel locks the room ──────────────────────────────────────────────
const duel = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { ROOMS } = await import('/src/data/rooms.js');
  gs.loadRoom(ROOMS[0]);
  await new Promise((r) => setTimeout(r, 1500));

  // Put trash on the floor FIRST, so the sweep has something to sweep — a
  // lockout that only holds an already-empty room proves nothing.
  for (let i = 0; i < 4; i++) gs.spawnEnemyAt('grunt', 300 + i * 60, 300);
  await new Promise((r) => setTimeout(r, 400));
  const trashBefore = gs.enemies.getChildren().filter((x) => x.alive).length;

  gs._beginDuel({ count: 8, miniBoss: true });
  await new Promise((r) => setTimeout(r, 600));
  const foe = gs.enemies.getChildren().find((x) => x.alive && x._miniBoss);
  const afterSweep = gs.enemies.getChildren().filter((x) => x.alive && !x._miniBoss).length;

  // Now run the arena for a while and count anything that arrives uninvited.
  // Swarmlings summoned BY the nemesis are legitimate and excluded.
  let maxAdds = 0;
  const t0 = performance.now();
  while (performance.now() - t0 < 7000) {
    const adds = gs.enemies.getChildren()
      .filter((x) => x.alive && !x._miniBoss && x._archetype !== 'swarmling').length;
    maxAdds = Math.max(maxAdds, adds);
    await new Promise((r) => setTimeout(r, 100));
  }

  const hud = window.game.scene.getScene('HUD');
  return {
    trashBefore,
    afterSweep,
    maxAdds,
    duelActive: !!gs._duelActive,
    barVisible: !!hud?.duelBar?.visible,
    barName: hud?.duelName?.text || '',
    foeName: foe?._nemesis?.name || '',
    moveCount: (foe?._moveIds || []).length,
  };
});

// ── 2b. The gate-telegraph race, made deterministic ───────────────────────
//
// `spawnAtGate` telegraphs for 600ms before the enemy materialises, and its
// completion originally checked only `arenaActive` — so a gate already in
// flight when a duel began dropped a trooper in AFTER the floor was swept.
//
// This first appeared as smoke-duel failing in the suite and passing on its
// own, which is the signature of a load-dependent race. Waiting for it to
// happen by luck is not a test: the spawn is started and the duel begun 150ms
// into its telegraph, so the window is hit every run.
const race = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { ROOMS } = await import('/src/data/rooms.js');
  gs.loadRoom(ROOMS[0]);
  await new Promise((r) => setTimeout(r, 1400));
  gs.enemies.getChildren().slice().forEach((x) => gs._destroyEnemyFully(x));
  await new Promise((r) => setTimeout(r, 300));

  gs.arenaActive = true;
  gs.spawnAtGate('grunt');                       // 600ms telegraph now running
  await new Promise((r) => setTimeout(r, 150));  // ...begin the duel inside it
  gs._beginDuel({ count: 8, miniBoss: true });
  await new Promise((r) => setTimeout(r, 2500));
  const adds = gs.enemies.getChildren().filter((x) => x.alive && !x._miniBoss).length;
  gs.enemies.getChildren().slice().forEach((x) => gs._destroyEnemyFully(x));
  return { adds };
});

// ── 3. Phases fire at the thresholds the bar draws pips at ────────────────
const phases = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { rollNemesis } = await import('/src/data/nemesis.js');
  // Spawn its OWN foe rather than reusing whatever an earlier section left
  // behind. Depending on that leftover is how this block came to report "none"
  // the moment a section above it started cleaning up after itself — and the
  // companion "fires exactly once" check passed anyway, because an empty list
  // has no duplicates in it.
  const nem = rollNemesis(5, { rng: gs.rng.nemesis, base: 'grunt', traits: ['armored'] });
  const foe = gs._spawnMiniBoss(nem);
  await new Promise((r) => setTimeout(r, 400));
  if (!foe) return { seen: [], ok: false };
  const seen = [];
  const onPhase = (e, p) => seen.push({ p, frac: +(e.hp / e.hpMax).toFixed(3) });
  gs.events.on('nemesis-phase', onPhase);

  foe.hpMax = 10000;
  foe.hp = 10000;
  // Walk it down in steps and let the tick observe each one, rather than
  // dropping straight to 10% — a single jump would hide a transition that only
  // fires on the exact frame it crosses.
  for (const frac of [0.9, 0.7, 0.64, 0.5, 0.36, 0.3, 0.2]) {
    foe.hp = foe.hpMax * frac;
    await new Promise((r) => setTimeout(r, 350));
  }
  gs.events.off('nemesis-phase', onPhase);
  return { seen, phase: foe._phase };
});

// ── 4. MINEFIELD actually seeds a field ───────────────────────────────────
//
// A screenshot cannot settle this: one frame at the start of ACT shows a single
// mine whether the move works or not, and the spread develops over 900ms. It
// was caught by eye as a PILE — the bomber retreated into the top wall, went
// nowhere, and dropped all five mines on one spot, so the move that is supposed
// to reshape the arena marked a single patch instead. Measured, not looked at.
const mines = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { ROOMS } = await import('/src/data/rooms.js');
  const { rollNemesis } = await import('/src/data/nemesis.js');
  gs.loadRoom(ROOMS[0]);
  await new Promise((r) => setTimeout(r, 1400));
  gs.enemies.getChildren().slice().forEach((x) => gs._destroyEnemyFully(x));
  await new Promise((r) => setTimeout(r, 250));

  const b = gs.physics.world.bounds;
  const out = [];
  // Two placements: mid-arena, and jammed against the top wall — the second is
  // the case that produced the pile, so testing only the first proves nothing.
  for (const spot of [{ x: b.width / 2, y: b.height / 2 }, { x: b.width / 2, y: 120 }]) {
    const nem = rollNemesis(4, { rng: gs.rng.nemesis, base: 'bomber', traits: ['volatile'] });
    const e = gs._spawnMiniBoss(nem);
    e.setPosition(spot.x, spot.y);
    e.body?.setVelocity(0, 0);
    gs.player.setPosition(spot.x, spot.y + 200);
    await new Promise((r) => setTimeout(r, 300));

    const start = { x: e.x, y: e.y };
    const seen = [];
    const sample = () => {
      for (const z of gs._telegraphs || []) {
        if (z.shape?.kind !== 'circle') continue;
        const p = { x: Math.round(z.shape.x), y: Math.round(z.shape.y) };
        if (!seen.some((s) => Math.hypot(s.x - p.x, s.y - p.y) < 6)) seen.push(p);
      }
    };
    gs.events.on('postupdate', sample);
    e._activeMove = null;
    gs._castNemesisMove(e, 'minefield');
    await new Promise((r) => setTimeout(r, 2600));
    gs.events.off('postupdate', sample);

    // Closest pair — one stacked pair is the whole failure.
    let closest = Infinity;
    for (let i = 0; i < seen.length; i++) {
      for (let j = i + 1; j < seen.length; j++) {
        closest = Math.min(closest, Math.hypot(seen[i].x - seen[j].x, seen[i].y - seen[j].y));
      }
    }
    // DIRECTION, not distance. Distance travelled is a frame-rate reading:
    // the same walled-in retreat measured 159px standalone and 66px under
    // suite load, so any pixel threshold on it is a threshold on how busy the
    // machine is. Whether the bomber went AWAY from the player is the thing the
    // move actually promises, and it does not move with the clock.
    const before = Math.hypot(start.x - gs.player.x, start.y - gs.player.y);
    const after = Math.hypot(e.x - gs.player.x, e.y - gs.player.y);
    out.push({
      laid: seen.length,
      closest: Number.isFinite(closest) ? Math.round(closest) : -1,
      retreated: after >= before - 1,
      gained: Math.round(after - before),
      inBounds: e.x > 0 && e.x < b.width && e.y > 0 && e.y < b.height,
    });
    gs._destroyEnemyFully(e);
    await new Promise((r) => setTimeout(r, 300));
  }
  return out;
});

// ── Screenshot: the duel bar, mid-fight ───────────────────────────────────
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  const foe = gs.enemies.getChildren().find((x) => x.alive && x._miniBoss);
  if (foe) { foe.hp = foe.hpMax * 0.5; gs.player.setPosition(foe.x, foe.y + 220); }
});
await page.waitForTimeout(500);
await page.screenshot({ path: 'tests/out/duel-bar.png' });

await browser.close();

// ── Verdict ───────────────────────────────────────────────────────────────
const r = { bomber, duel, phases };

check(bomber.touched > 0,
  'the bomber nemesis really did make contact',
  `${bomber.touched} frames in contact range — if this is 0 the check below is vacuous`);
check(bomber.alive && bomber.active && !bomber.detonated,
  'a bomber nemesis SURVIVES touching the player',
  `alive=${bomber.alive} detonated=${bomber.detonated} — stock _detonate() sets hp=0 and dies`);
check(bomber.hpAfter > bomber.hpMax * 0.5,
  'and keeps the hp pool it was given',
  `${Math.round(bomber.hpAfter)}/${bomber.hpMax} left`);

check(duel.trashBefore >= 4,
  'there was trash on the floor for the duel to clear',
  `${duel.trashBefore} enemies before the duel — guards against an empty-room false pass`);
check(duel.afterSweep === 0,
  'starting a duel clears the floor',
  `${duel.afterSweep} non-nemesis enemies left standing`);
check(duel.maxAdds === 0,
  'and no wave adds arrive while it runs',
  `peak uninvited adds: ${duel.maxAdds} over 7s`);
check(race.adds === 0,
  'a gate telegraph already in flight cannot drop an add into the duel',
  `${race.adds} arrived after the sweep — this is the race that only showed up under suite load`);
check(duel.barVisible && duel.barName.length > 0,
  'the duel names its opponent and shows a health bar',
  `bar=${duel.barVisible} name="${duel.barName}"`);
check(duel.moveCount >= 3,
  'the nemesis carries a real kit, not two moves',
  `${duel.moveCount} moves`);

const gotPhases = (phases.seen || []).map((s) => s.p);
check(gotPhases.includes(2) && gotPhases.includes(3),
  'phases fire at the thresholds the bar draws pips at',
  (phases.seen || []).map((s) => `p${s.p}@${s.frac}`).join(' ') || 'none');
check(gotPhases.length > 0 && gotPhases.length === new Set(gotPhases).size,
  'and each fires exactly once',
  // The length guard is not decoration: without it this passed while the check
  // above it failed with "none", because an empty list has no duplicates.
  gotPhases.length ? gotPhases.join(',') : 'no transitions fired at all');

const [mid, wall] = mines;
check(mid.laid >= 3 && wall.laid >= 3,
  'MINEFIELD lays a field, not one mine',
  `mid-arena ${mid.laid}, against a wall ${wall.laid}`);
check(mid.closest >= 60 && wall.closest >= 60,
  'and spaces them out even when the retreat is walled in',
  `closest pair — mid-arena ${mid.closest}px, against a wall ${wall.closest}px`);
check(mid.retreated && wall.retreated && wall.inBounds,
  'a bomber jammed against a wall retreats AWAY, not into the player',
  `distance gained — mid-arena ${mid.gained}px, against a wall ${wall.gained}px;`
  + ` in bounds: ${wall.inBounds}`);

check(pageErrors.length === 0, 'no exception across the run', pageErrors.join(' | '));

let bad = 0;
for (const c of checks) {
  console.log(`  ${c.ok ? 'ok  ' : 'FAIL'}  ${c.label}${c.detail ? ` — ${c.detail}` : ''}`);
  if (!c.ok) bad++;
}
console.log(`  (screenshot: tests/out/duel-bar.png)`);
if (bad) fail(`${bad} of ${checks.length} checks failed: ${checks.filter((c) => !c.ok)[0].label}`);
console.log(`PASS: ${checks.length} checks — a nemesis encounter is a duel, and the bomber survives it`);
