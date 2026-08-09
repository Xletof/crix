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
//   node tests/diag-encounter.mjs --mode vader --repeats 3            # the ladder
//   node tests/diag-encounter.mjs --mode vader --spam 0               # patient
//   node tests/diag-encounter.mjs --mode vader --upgrades 0           # stock A/B

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

// `?nodlg=1` mutes the dialogue cards. They pause Game and HUD and wait for a
// tap, which hangs a bot for the whole measurement cap — see systems/debug.js.
const URL = 'http://localhost:5173/?nodlg=1';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : dflt;
};
const MODE = arg('mode', 'all');
const RUNS = Number(arg('runs', 2));
const SECTOR = Number(arg('sector', 12));
// 180s. The default was 30s, which is shorter than a late encounter actually
// takes — so encounter 6 reported "OVER CAP" when all that had happened was the
// stopwatch running out. A cap is a safety net against a hung fight, not a
// judgement, and it must sit well above the longest real answer.
const CAP_MS = Number(arg('cap', 180000));

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

    // SPAM MODE — model how the game is actually played.
    //
    // The default policy is a patient shooter: hold range, poke, super when
    // charged. The user plays Vader by mashing both supers with god mode on,
    // and that is the profile the per-encounter damage cap punished hardest —
    // a 5-pellet super arrives in ONE 120ms window, so a 3000-damage volley
    // landed as 960 at encounter 6. The harness never saw it because the
    // harness never played that way.
    //
    // A balance instrument that cannot express the actual playstyle cannot
    // catch a bug that only exists for that playstyle. This makes the meters
    // free and the bot mash, which is the god-mode case.
    spam: false,
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
        // Close to melee range while the chain is charged, then back off.
        //
        // Holding a flat 260px made the bot fight SLOW enemies far worse than
        // fast ones: ARMORED and COLOSSAL never reach the player, so melee
        // never fires and output collapses to pistol-plus-super. Measured 83-198
        // dmg/sec on those against 753 on a baseline that chases — which
        // double-counts every slowing trait as both more hp AND a worse player.
        // A human walks in to spend a charged melee, so the bot does too.
        const WANT = (p.meleeReady || p._comboStage > 0) ? 110 : 260;
        let mx, my;
        if (dist < WANT - 50)      { mx = -ux; my = -uy; }        // back off
        else if (dist > WANT + 40) { mx = ux;  my = uy;  }        // close in
        else                       { mx = -uy; my = ux;  }        // strafe
        p.setMoveInput({ x: mx, y: my, force: 1 });
      }
      const s = this.stats;
      // Count what actually landed. The breakdown matters: a super that
      // silently never fires would make the derived numbers quietly wrong in
      // the direction of "too easy".
      if (this.spam) {
        // Meters refilled every frame, so the only limits left are the ability
        // cooldowns themselves — the ceiling a mashing player approaches.
        // The thresholds are config constants (PLAYER.superHitsToCharge = 4,
        // meleeHitsToCharge = 3), not fields on the player, so overfilling is
        // the way to say "always ready" without importing config in here.
        p.superCharge = 99;
        p.meleeCharge = 99;
        p.ammo = Math.max(p.ammo, 1);
      }
      if (p.tryFire(ang) !== false && s) s.shots++;
      if (p.tryFireSuper(ang) !== false && s) s.supers++;
      if ((this.spam || dist < 150) && p.tryMeleeCombo(ang) !== false && s) s.melees++;

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

// ── Mode C: the Vader ladder ──────────────────────────────────────────────
//
// The target is a 60-90s fight playing well, so all three phases land. Nothing
// had ever measured whether that happened, and the two knobs that decide it —
// `bossHpStep` and the old `bossDamageCap` — were both invented. The first run
// of this found the answer was 10.6 SECONDS. The cap has since been removed
// from the game entirely, and the columns that reported it are gone with it:
// they printed `cap undefined` and `cap floor NaN` in every row, and a
// diagnostic that prints NaN teaches its reader to skim past its own output.
//
// Two things this path gets right that it did not before, both of which had to
// be fixed BEFORE any hp number was touched:
//
//   - the bot arrives with the UPGRADES a real run would have (see the block
//     inside `fightVader`). Without them it was a stock Player at every rung.
//   - each rung is sampled `--repeats` times and the SPREAD is reported. Fight
//     length is wall clock in a browser; one sample cannot tell you it is noise.
async function fightVader(encounter, capMs, spam = false, upgrades = true, run = 0) {
  return page.evaluate(async ({ encounter, capMs, spam, upgrades, run }) => {
    const gs = window.game.scene.getScene('Game');
    const { ROOMS } = await import('/src/data/rooms.js');
    const { ENDLESS } = await import('/src/config.js');
    const { pickThree } = await import('/src/data/upgrades.js');
    const { makeRng } = await import('/src/systems/rng.js');

    gs.sector = encounter * ENDLESS.bossEvery;
    gs.loadRoom(ROOMS.find((r) => r.boss));
    await new Promise((r) => setTimeout(r, 2000));

    // Same isolation as the loadout sweep: one encounter, not a wave.
    gs.arenaActive = false;
    gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
    gs.player.shieldHp = 0;
    gs.player.superCharge = 0;
    gs.player.meleeCharge = 0;
    gs.lives = 9999;              // defeat() must never fire mid-measurement

    // ── The build the player actually brings ──────────────────────────────
    //
    // The bot used to arrive at every rung with a stock Player, while a real run
    // reaching encounter 6 has cleared 29 rooms and taken 29 upgrade cards. Six
    // of the fourteen multiply `dmgMult`, and they COMPOUND — so the harness was
    // measuring a player who does not exist, and the whole ladder table was a
    // measurement of the wrong fight.
    //
    // Upgrades are applied through the game's own path: the real `pickThree`
    // against the real `UPGRADES`, `up.apply(p)`, `p._upgrades.push(id)` —
    // exactly what `UpgradeScene._pick` does. One path in, one set of numbers
    // out; tuning a card moves this harness too. `pickThree` draws on
    // `Math.random`, so it is stubbed with a seeded stream for the duration
    // rather than reimplemented, which would fork the selection logic.
    const p = gs.player;
    // Snapshot a virgin Player once. The same instance survives every rung, and
    // upgrades mutate it in place, so without this the builds would stack across
    // the whole ladder.
    if (!window.__playerBaseline) {
      window.__playerBaseline = {
        dmgMult: p.dmgMult, reloadMult: p.reloadMult, moveMult: p.moveMult,
        dashChargesBonus: p.dashChargesBonus, dashRechargeMult: p.dashRechargeMult,
        superGainMult: p.superGainMult, regenMult: p.regenMult,
        killHeal: p.killHeal, hpMax: p.hpMax,
      };
    }
    Object.assign(p, window.__playerBaseline);
    p._upgrades = [];

    // One card per room cleared. Encounter n sits at sector 5n, so 5n-1 rooms
    // are behind it.
    const picks = upgrades ? encounter * ENDLESS.bossEvery - 1 : 0;
    if (picks > 0) {
      // ONE seed for the whole ladder — not per repeat, and not per encounter.
      //
      // A run ACCUMULATES. Encounter 2's build is encounter 1's four cards plus
      // five more; it is not an independent draw of nine. Because `pickThree`
      // is driven off `taken`, replaying the same stream from the same seed
      // reproduces the earlier picks exactly and then continues, so rung n's
      // build is a true prefix of rung n+1's.
      //
      // Both alternatives were tried and both broke the same rule — a
      // measurement must vary ONE thing:
      //   - seeded per REPEAT: three runs of one rung came back 4.6s, 21.1s,
      //     4.6s, reported as 348% spread that was mostly three different
      //     players rather than any property of the fight;
      //   - seeded per ENCOUNTER: rung 3 drew 14 cards worth x3.4 damage while
      //     rung 2 drew 9 worth x4.07, so a rung-to-rung comparison mixed hp
      //     scaling with build luck and the ladder could not be read at all.
      const rng = makeRng(0x11f0);
      const realRandom = Math.random;
      Math.random = rng.rand;
      try {
        for (let i = 0; i < picks; i++) {
          const three = pickThree(p._upgrades);
          const up = three[Math.floor(rng.rand() * three.length)];
          if (!up) break;
          up.apply(p);
          p._upgrades.push(up.id);
        }
      } finally {
        Math.random = realRandom;   // synchronous block: no frame runs stubbed
      }
    }
    p.hp = p.hpMax;                 // after the cards, which move hpMax

    if (!gs.boss?.alive) {
      gs.spawnBoss(gs.player.x + 400, gs.player.y);
      await new Promise((r) => setTimeout(r, 600));
    }
    const boss = gs.boss;
    const hpMax = boss.hpMax;
    const dmgBefore = gs.runDamageTaken || 0;

    let deaths = 0;
    const onDead = () => deaths++;
    gs.events.on('player-dead', onDead);

    // WHEN the phases land, not just the total. The whole point of the 60-90s
    // target is that all three happen — a fight that spends 55s in phase 1 and
    // 3s in phase 3 hits the band and still fails the intent.
    const phaseAt = {};
    // Named `phase`, not `p` — `p` is the player in this scope now.
    const onPhase = (phase) => { phaseAt[phase] = Math.round(performance.now() - t0); };
    gs.events.on('boss-phase', onPhase);

    window.__bot.target = boss;
    window.__bot.stats = { frames: 0, shots: 0, supers: 0, melees: 0, dashes: 0, revives: 0 };
    window.__bot.spam = !!spam;
    window.__bot.on = true;

    const t0 = performance.now();
    let elapsed = 0;
    while (boss.active && boss.alive && elapsed < capMs) {
      await new Promise((r) => setTimeout(r, 100));
      elapsed = performance.now() - t0;
    }
    window.__bot.on = false;
    window.__bot.spam = false;
    gs.events.off('player-dead', onDead);
    gs.events.off('boss-phase', onPhase);

    return {
      encounter,
      downed: !boss.alive,
      ms: Math.round(elapsed),
      hpMax: Math.round(hpMax),
      hpEnd: Math.round(Math.max(0, boss.hp)),
      phaseAt,
      // The build that fought it. `dmgMult` is the single number that explains
      // most of the difference between two rungs, so it is reported rather than
      // left implicit in "upgrades were on".
      picks,
      dmgMult: Math.round(p.dmgMult * 100) / 100,
      playerHpMax: Math.round(p.hpMax),
      damageTaken: Math.round((gs.runDamageTaken || 0) - dmgBefore),
      deaths,
      revives: window.__bot.stats.revives,
      supers: window.__bot.stats.supers,
      melees: window.__bot.stats.melees,
      mechanics: (boss._mechanics || []).slice(),
    };
  }, { encounter, capMs, spam, upgrades, run });
}

// ── Run ───────────────────────────────────────────────────────────────────
const out = [];

if (MODE === 'vader') {
  const last = Number(arg('encounters', 6));
  const SPAM = arg('spam', '1') !== '0';
  const UPG = arg('upgrades', '1') !== '0';
  // Three runs per rung, not one.
  //
  // Fight length here is WALL CLOCK in a real browser, so it carries the
  // machine's frame rate and whatever else is running. The dps path has always
  // taken four samples and warned above 30% spread; the ladder took ONE and the
  // six numbers it produced were about to be used to set two config constants.
  // Every intermittent result in this project has turned out to be the
  // instrument (see docs/POST-MORTEM-vader-moves.md), and a single sample cannot
  // tell you that it is one.
  const REPEATS = Number(arg('repeats', 3));
  const median = (xs) => {
    const s = xs.slice().sort((a, b) => a - b);
    return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
  };

  console.log(`\n── Vader ladder (encounters 1-${last}, ${CAP_MS / 1000}s cap, `
    + `${REPEATS} run(s) each) ──`);
  console.log(`   policy: ${SPAM ? 'spam' : 'patient'}   upgrades: ${UPG ? 'on' : 'OFF'}`);
  console.log('   target: 60-90s with all three phases reached\n');

  for (let n = 1; n <= last; n++) {
    const runs = [];
    for (let i = 0; i < REPEATS; i++) runs.push(await fightVader(n, CAP_MS, SPAM, UPG, i));

    const msList = runs.map((r) => r.ms);
    const med = median(msList);
    const spread = med ? (Math.max(...msList) - Math.min(...msList)) / med : 0;
    const r = runs[0];
    const downedAll = runs.every((x) => x.downed);
    const band = !downedAll ? 'OVER CAP' : med < 60000 ? 'TOO SHORT' : med > 90000 ? 'TOO LONG' : 'in band';
    // Phase timings from the median run, so the row is internally consistent
    // rather than an average of fights that went differently.
    const medRun = runs.find((x) => x.ms === med) || r;
    const ph = [2, 3].map((p) => medRun.phaseAt[p] != null
      ? `p${p} ${(medRun.phaseAt[p] / 1000).toFixed(0)}s` : `p${p} NEVER`).join(', ');

    console.log(`  encounter ${n}  hp ${String(r.hpMax).padStart(6)}  `
      + `${(med / 1000).toFixed(1)}s${downedAll ? '' : ` (${medRun.hpEnd} left)`}  [${band}]`);
    console.log(`      runs: ${msList.map((m) => (m / 1000).toFixed(1)).join(', ')}s`
      + `   spread ${(spread * 100).toFixed(0)}%${spread > 0.25 ? '  ** NOISY **' : ''}`);
    // The repeats are only comparable if they were the same player. Assert it
    // rather than trust it — this is exactly what was silently false before.
    const sameBuild = runs.every((x) => x.dmgMult === r.dmgMult && x.playerHpMax === r.playerHpMax);
    console.log(`      build: ${r.picks} upgrades, dmg x${r.dmgMult}, player hp ${r.playerHpMax}`
      + `${sameBuild ? '' : '   ** BUILD VARIED ACROSS RUNS — spread above is meaningless **'}`);
    console.log(`      phases: ${ph}   `
      + `taken ${medRun.damageTaken}  deaths ${medRun.deaths}  `
      + `supers ${medRun.supers} melee ${medRun.melees}`);
    console.log(`      mechanics: ${r.mechanics.join(', ') || 'none'}`);
    out.push({ ...medRun, ms: med, spread, runs: msList });
  }

  if (!UPG) {
    console.log('\n  NOTE: --upgrades 0 — the bot arrives stock at every rung, while a'
      + '\n  real run reaching encounter 6 has taken 29 cards. This is the A/B'
      + '\n  baseline, not a picture of the game.');
  }
}

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
    + `-${Math.round(mean * 90).toLocaleString()} hp — for a STOCK player. The ladder`
    + `\n  (--mode vader) models the upgrades a real run brings; use that to size Vader.`);
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
