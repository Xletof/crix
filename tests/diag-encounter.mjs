// Encounter balance harness — MEASUREMENT, not a gate.
//
// Why this exists: every balance number in the nemesis system was invented.
// Trait multipliers (2.2x hp, 1.45x speed, 0.022/s regen), the VOLATILE blast
// (190px / 260 dmg), Vader's hp curve and his intake cap — all guessed, none
// measured. There was no way to answer "is a 3-trait sector-30 nemesis a wall?"
// except by playing it, and no way to compare two loadouts at all.
//
// This drives a scripted player against seeded encounters and reports how long
// each takes and what it costs. Numbers set from its output go into config with
// the measured figure in a comment.
//
// ── WHAT THIS IS NOT ──────────────────────────────────────────────────────
//
// The bot is a YARDSTICK, NOT A PLAYER. It can tell you ARMORED+COLOSSAL is
// 3.4x the fight SWIFT is. It cannot tell you whether either is fun, whether a
// VOLATILE blast reads as avoidable or as a cheap shot, or whether a fight is
// tense or tedious. Every ABSOLUTE judgement stays a phone playtest. What this
// buys is RELATIVE comparison and outlier detection — it stops a loadout
// shipping at 5x the median without anyone noticing.
//
// It is also a deliberately mediocre player: fixed policy, no learning, no
// resource planning, no reading of telegraphs beyond distance. Treat its TTK as
// a slow-competent baseline, not a speedrun.
//
// ── Harness discipline (see tests/README.md) ──────────────────────────────
//
// The bot runs INSIDE the page on a `postupdate` hook. Driving it from Node
// would cost a 200-400ms round trip per decision — slower than the game's own
// frame — and would measure the harness rather than the fight.
//
// NOT in run-all.mjs: a full sweep is minutes of real time, and it has no
// pass/fail. Run it on demand.
//
// Usage:
//   node tests/diag-encounter.mjs                 # dps calibration + core sweep
//   node tests/diag-encounter.mjs --mode dps
//   node tests/diag-encounter.mjs --mode sweep --runs 3
//   node tests/diag-encounter.mjs --sector 30

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const URL = 'http://localhost:5173/';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : dflt;
};
const MODE = arg('mode', 'all');
const RUNS = Number(arg('runs', 2));
const SECTOR = Number(arg('sector', 12));
const CAP_MS = Number(arg('cap', 30000));

// The loadouts swept. Deliberately not all 41 combinations — that is ~40 minutes
// of wall clock for a diagnostic. Every trait alone (so each one's individual
// cost is known), plus the pairs most likely to compound badly, plus a bare
// baseline to measure everything else against.
const LOADOUTS = [
  { name: 'baseline', traits: [] },
  { name: 'armored', traits: ['armored'] },
  { name: 'swift', traits: ['swift'] },
  { name: 'colossal', traits: ['colossal'] },
  { name: 'regenerator', traits: ['regenerator'] },
  { name: 'summoner', traits: ['summoner'] },
  { name: 'volatile', traits: ['volatile'] },
  { name: 'armored+colossal', traits: ['armored', 'colossal'] },
  { name: 'armored+regenerator', traits: ['armored', 'regenerator'] },
  { name: 'swift+volatile', traits: ['swift', 'volatile'] },
  { name: 'summoner+regenerator', traits: ['summoner', 'regenerator'] },
];

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
page.on('pageerror', (e) => console.error('PAGE ERROR', e.message));

await page.goto(URL);
await page.waitForTimeout(4500);
await page.mouse.click(360, 640);
await page.waitForTimeout(800);
await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 20260101 }));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(1800);

// ── Install the bot ───────────────────────────────────────────────────────
// One hook, installed once, driven by a control object the outer script flips.
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  if (window.__botInstalled) return;   // one hook, however often this runs
  window.__botInstalled = true;

  window.__bot = {
    on: false,
    target: null,
    stats: null,
    // Suppress movement. Used ONLY for the ceiling measurement: strafing changes
    // the range and angle every frame, so super-pellet hits vary, and because a
    // super partly recharges itself off its own pellet hits that variance
    // cascades. Measured spread with movement on was 467-900 dmg/sec across
    // three identical runs — a 2x instrument, which makes every number above it
    // meaningless. Standing still removes the geometry noise from a number that
    // is supposed to be "maximum output", not "a fight".
    hold: false,
    // Pin both parties to fixed positions each tick, for the ceiling bench.
    // "Stationary dummy" was not stationary: the super carries 500 knockback,
    // melee 260 and the slam 900, so a pair starting 130px apart measured
    // 514-585px apart by the end of a 30s window. The range therefore wandered
    // continuously and pellet hits with it, which is what produced a 104%
    // spread across identical runs. A bench measures output, so the geometry is
    // held constant rather than left to the physics.
    pin: null,

    // Policy, stated plainly so the numbers can be read in context:
    //  - hold ~260px, which is inside rifle range and outside most melee
    //  - fire every frame; tryFire self-gates on cooldown, ammo and reload
    //  - super the moment it is charged (no saving it for a better moment —
    //    a human would, and that is one reason this is a slow baseline)
    //  - melee-chain only inside 150px
    //  - dash out below 90px, which is also what clears a VOLATILE blast
    step() {
      const p = gs.player;
      const t = this.target;
      if (!this.on || !p) return;
      // Keep the run alive WITHOUT god mode: damage taken is one of the numbers
      // being measured, so the player must still be hurt — just never finished.
      // Left to itself the bot died three times against a sector-12 nemesis,
      // `defeat()` fired, and GameScene tore down mid-measurement, taking the
      // enemy group with it. Revived here on the frame tick rather than on the
      // outer 100ms poll, which was far too coarse to catch it.
      if (!p.alive) {
        this.stats && this.stats.revives++;
        p.alive = true;
        p.hp = p.hpMax;
        p.setActive(true).setVisible(true).setAlpha(1);
      }
      if (!t || !t.active || !t.alive) { p.setMoveInput({ x: 0, y: 0, force: 0 }); return; }

      const dx = t.x - p.x, dy = t.y - p.y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      const ang = Math.atan2(dy, dx);
      const ux = dx / dist, uy = dy / dist;

      if (this.pin) {
        p.setPosition(this.pin.px, this.pin.py);
        p.setVelocity(0, 0);
        t.setPosition(this.pin.tx, this.pin.ty);
        t.body?.setVelocity(0, 0);
      }
      if (this.hold) {
        p.setMoveInput({ x: 0, y: 0, force: 0 });
      } else {
        const WANT = 260;
        let mx, my;
        if (dist < WANT - 50)      { mx = -ux; my = -uy; }        // back off
        else if (dist > WANT + 70) { mx = ux;  my = uy;  }        // close in
        else                       { mx = -uy; my = ux;  }        // strafe
        p.setMoveInput({ x: mx, y: my, force: 1 });
      }
      const s = this.stats;
      // Count what actually landed. The breakdown matters: a super that
      // silently never fires would make the derived numbers quietly wrong in
      // the direction of "too easy".
      if (p.tryFire(ang) !== false && s) s.shots++;
      if (p.tryFireSuper(ang) !== false && s) s.supers++;
      if (dist < 150 && p.tryMeleeCombo(ang) !== false && s) s.melees++;

      // Dash-flank. Strafing at 260px gives ~1.46 rad/s of angular travel while
      // a shielded enemy turns at 2.6 — so a strafing bot can NEVER get behind
      // one, and measured exactly zero damage against it. The dash (950px/s for
      // 240ms) crosses the gap faster than it can turn, which is the same thing
      // a human has to do. Fired on a timer rather than every frame so the bot
      // is not permanently mid-dash.
      this._dashCd = (this._dashCd || 0) - (gs.game.loop.delta || 16);
      if (this._dashCd <= 0 && dist < 340) {
        if (p.tryDash() !== false) { this._dashCd = 2200; if (s) s.dashes++; }
      }

      if (s) {
        s.frames++;
        s.superCharge = p.superCharge;
        s.meleeCharge = p.meleeCharge;
      }
    },
  };

  gs.events.on('postupdate', () => window.__bot.step());
});

// ── Mode A: reference fight ───────────────────────────────────────────────
//
// This started as a point-blank bench with both parties pinned, to measure a
// "ceiling DPS" from which Vader's hp would be derived. That was the wrong
// instrument, and the harness said so before any number came out of it:
//
//   - unpinned, the pair drifted from 130px to ~550px apart inside one window,
//     because the super carries 500 knockback and the slam 900. The range —
//     and with it every pellet hit — wandered continuously. Spread 104%.
//   - pinned at point blank, output leapt to ~4,750 dmg/sec with 69 supers in
//     30 seconds. Melee hits charge the SUPER meter (GameScene:1382) and at
//     contact range both meters refill faster than they are spent, so the kit
//     loops. That regime is real but unreachable in play: knockback is exactly
//     what stops you standing there. Spread 87%.
//
// A bench that only exists with the physics switched off cannot size a boss.
// So the reference number comes from a REAL fight instead — the bot against a
// bare no-trait nemesis, moving, taking damage, at a fixed seed. That is the
// figure Vader's hp should be derived from, because it is the situation Vader
// is actually in.

// ── Mode B: loadout sweep ─────────────────────────────────────────────────
async function fightLoadout(traits, sector, capMs) {
  return page.evaluate(async ({ traits, sector, capMs }) => {
    const gs = window.game.scene.getScene('Game');
    const { ROOMS } = await import('/src/data/rooms.js');
    const { rollNemesis } = await import('/src/data/nemesis.js');
    const { makeRng } = await import('/src/systems/rng.js');

    gs.loadRoom(ROOMS[0]);
    await new Promise((r) => setTimeout(r, 1400));
    // Clear the room's scripted enemies: this measures ONE encounter, not a
    // wave, and stray grunts would both add damage and feed the player's meters.
    gs.arenaActive = false;
    gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));

    gs.player.hp = gs.player.hpMax;
    gs.player.shieldHp = 0;
    gs.player.superCharge = 0;
    gs.player.meleeCharge = 0;
    gs.player.setPosition(700, 700);
    gs.sector = sector;
    gs.lives = 9999;   // defeat() must never fire mid-measurement
    // Pin the endless sector multipliers. loadRoom -> _startWave ->
    // _applySectorScaling rewrites these from whatever sector the scene last
    // ran, so consecutive runs were fighting different-hp nemeses (measured
    // 7795 then 14658 for the same loadout) and the comparison was meaningless.
    gs.enemyHpMult = 1;
    gs.enemySpeedMult = 1;

    // Fixed seed per loadout so a re-run compares like with like — the whole
    // point of phase 0.
    // Base held to 'grunt' on purpose. This sweep measures TRAITS, so
    // everything else has to be constant — and the roll is otherwise free to
    // pick `shielded`, whose 154-degree frontal shield changes the fight far
    // more than any trait does. Seed 1000 did exactly that and every baseline
    // run reported zero damage, which read as a broken harness rather than as
    // a shielded enemy behaving correctly. Base variation is worth its own
    // sweep; mixing it into this one confounds the thing being measured.
    const nem = rollNemesis(sector, { traits, base: 'grunt', rng: makeRng(1000 + traits.length) });
    const boss = gs._spawnMiniBoss(nem);
    await new Promise((r) => setTimeout(r, 400));

    const dmgBefore = gs.runDamageTaken || 0;
    const hpMax = boss.hpMax;
    let deaths = 0;
    const onDead = () => deaths++;
    gs.events.on('player-dead', onDead);

    window.__bot.target = boss;
    window.__bot.stats = { frames: 0, shots: 0, supers: 0, melees: 0, dashes: 0, revives: 0, superCharge: 0, meleeCharge: 0 };
    window.__bot.on = true;

    const t0 = performance.now();
    let elapsed = 0;
    while (boss.active && boss.alive && elapsed < capMs) {
      await new Promise((r) => setTimeout(r, 100));
      elapsed = performance.now() - t0;
      // A dead player would otherwise sit there while the clock ran.
      // (revival happens on the bot's frame tick — see step())
    }
    window.__bot.on = false;
    gs.events.off('player-dead', onDead);

    const killed = !boss.alive || !boss.active;
    const remaining = killed ? 0 : Math.max(0, boss.hp);
    const dealt = hpMax - remaining;

    if (boss.active) gs._destroyEnemyFully(boss);
    gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));

    return {
      killed,
      ms: Math.round(elapsed),
      hpMax: Math.round(hpMax),
      dealt: Math.round(dealt),
      remainingFrac: hpMax ? remaining / hpMax : 0,
      damageTaken: Math.round((gs.runDamageTaken || 0) - dmgBefore),
      deaths,
      revives: window.__bot.stats.revives,
      shots: window.__bot.stats.shots,
      supers: window.__bot.stats.supers,
      melees: window.__bot.stats.melees,
      frames: window.__bot.stats.frames,
      bossHpEnd: Math.round(boss.hp),
      playerAlive: gs.player.alive,
      endDist: Math.round(Math.hypot(boss.x - gs.player.x, boss.y - gs.player.y)),
      bossPos: [Math.round(boss.x), Math.round(boss.y)],
      playerPos: [Math.round(gs.player.x), Math.round(gs.player.y)],
      bodyEnabled: !!gs.player.body?.enable,
      name: nem.name,
      base: nem.base,
    };
  }, { traits, sector, capMs });
}

// ── Run ───────────────────────────────────────────────────────────────────
const out = [];

if (MODE === 'all' || MODE === 'dps') {
  console.log('\n── Reference fight (bare nemesis, bot moving and taking damage) ──');
  // Repeatability FIRST. An unstable instrument makes every number above it
  // meaningless, so the spread is reported before the value is used.
  const ref = [];
  for (let i = 0; i < 4; i++) ref.push(await fightLoadout([], SECTOR, CAP_MS));
  const killedAll = ref.every((r) => r.killed);
  const dpsList = ref.map((r) => r.dealt / (r.ms / 1000));
  const mean = dpsList.reduce((x, y) => x + y, 0) / dpsList.length;
  const spread = (Math.max(...dpsList) - Math.min(...dpsList)) / mean;

  console.log(`  runs: ${ref.map((r) => `${(r.ms / 1000).toFixed(1)}s${r.killed ? '' : '*'}`).join(', ')}`
    + `  (hp ${ref[0].hpMax}, sector ${SECTOR})`);
  console.log(`  effective dps: ${dpsList.map((d) => Math.round(d)).join(', ')}`);
  console.log(`  mean ${Math.round(mean)} dmg/sec, spread ${(spread * 100).toFixed(0)}%`);
  console.log(`  damage taken: ${ref.map((r) => r.damageTaken).join(', ')}`);
  ref.forEach((r, i) => console.log(`    run${i}: frames ${r.frames} shots ${r.shots} supers ${r.supers} `
    + `melee ${r.melees} revives ${r.revives} bossHp ${r.bossHpEnd}/${r.hpMax} alive ${r.playerAlive} `
    + `dist ${r.endDist} p${r.playerPos} b${r.bossPos} body ${r.bodyEnabled}`));

  if (!killedAll) console.log('  ** some runs did not finish inside the cap **');
  if (spread > 0.30) {
    console.log('  ** NOISY (>30% spread) — treat comparisons below ~1.5x as meaningless. **');
  }
  console.log(`  A 60-90s fight at this rate needs ${Math.round(mean * 60).toLocaleString()}`
    + `-${Math.round(mean * 90).toLocaleString()} hp, BEFORE the boss damage cap is applied.`);
}

if (MODE === 'all' || MODE === 'sweep') {
  console.log(`\n── Loadout sweep (sector ${SECTOR}, ${RUNS} run(s), ${CAP_MS / 1000}s cap) ──`);
  for (const lo of LOADOUTS) {
    const runs = [];
    for (let i = 0; i < RUNS; i++) runs.push(await fightLoadout(lo.traits, SECTOR, CAP_MS));
    const mean = (f) => runs.reduce((a, r) => a + f(r), 0) / runs.length;
    const killedAll = runs.every((r) => r.killed);
    out.push({
      name: lo.name,
      hpMax: Math.round(mean((r) => r.hpMax)),
      ttk: killedAll ? Math.round(mean((r) => r.ms)) : null,
      dps: Math.round(mean((r) => r.dealt / (r.ms / 1000))),
      taken: Math.round(mean((r) => r.damageTaken)),
      deaths: mean((r) => r.deaths).toFixed(1),
      leftFrac: mean((r) => r.remainingFrac),
    });
    const row = out[out.length - 1];
    console.log(`  ${lo.name.padEnd(22)} hp ${String(row.hpMax).padStart(7)}  `
      + `${row.ttk !== null ? `ttk ${(row.ttk / 1000).toFixed(1)}s` : `NOT KILLED in cap (${(row.leftFrac * 100).toFixed(0)}% left)`}`
      + `  dps ${String(row.dps).padStart(5)}  taken ${String(row.taken).padStart(5)}  deaths ${row.deaths}`);
  }

  // Outlier report — the thing this harness exists to produce.
  const killed = out.filter((r) => r.ttk !== null).sort((a, b) => a.ttk - b.ttk);
  if (killed.length) {
    const median = killed[Math.floor(killed.length / 2)].ttk;
    console.log(`\n  median ttk ${(median / 1000).toFixed(1)}s`);
    const bad = out.filter((r) => r.ttk === null || r.ttk > median * 2 || r.ttk < median * 0.5);
    if (bad.length) {
      console.log('  OUTLIERS (>2x or <0.5x median, or unkillable inside the cap):');
      for (const b of bad) {
        console.log(`    ${b.name} — ${b.ttk === null ? `unkilled, ${(b.leftFrac * 100).toFixed(0)}% left` : `${(b.ttk / 1000).toFixed(1)}s`}`);
      }
    } else {
      console.log('  no outliers — every loadout inside 0.5x-2x of the median');
    }
  }
}

await browser.close();
console.log('\nDiagnostic only — no pass/fail. Absolutes stay a phone judgement.\n');
