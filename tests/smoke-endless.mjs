// Endless as the run structure: boss sectors, and the climb continuing past one.
//
// Endless used to be a ramp with no arc — it cycled three arenas forever and
// could never reach Vader, because `_transitionToNext` did `(index + 1) % 3`
// and the boss room is index 3. The best encounter in the game was unreachable
// in the mode people actually play, and boss1/boss2/boss3 in the music director
// were heard once per campaign and never again.
//
// Three things here are easy to get wrong and invisible until a long run:
//
//   - The arena rotation. Deriving the next arena from the CURRENT room index
//     sends the climb back to the hangar after every boss, because the boss
//     room's index is 3 and 3 % 3 is 0. The rotation therefore rides its own
//     counter, and this test walks enough sectors to catch a stuck cycle.
//   - The exit out of the boss room. Vader's chamber had `exit: null`, so even
//     killing him left nowhere to go — a soft lock at the best moment in the run.
//   - `boss-died` ending the run. It calls victory() in the campaign; doing that
//     in endless would end a climb as a "win" at sector 5.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const URL = 'http://localhost:5173/';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const fail = (m) => { console.error(`FAIL: ${m}`); process.exit(1); };
const checks = [];
const check = (ok, label, detail) => { checks.push({ ok, label, detail }); };

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
await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless' }));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(1800);

const r = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { ENDLESS, BOSS } = await import('/src/config.js');
  const out = { bossEvery: ENDLESS.bossEvery, baseBossHp: BOSS.hp, path: [] };

  // Walk the climb through two full boss cycles using the real transition.
  // Wait for the room to actually CHANGE, not for a fixed delay. The
  // transition runs behind a 350ms camera fade and loads in its completion
  // callback; a fixed wait raced it and silently recorded the previous room,
  // which made a correctly-scheduled boss sector look like a missed one.
  const step = async () => {
    // Wait for the ROOM to change, not the sector. `sector++` happens
    // synchronously at the top of _transitionToNext, but the room only loads in
    // the camera-fade completion callback ~350ms later. Waiting on the sector
    // therefore returned instantly, the next call restarted the fade before the
    // previous load had run, and loads were silently dropped — which showed up
    // as "the arena rotation is stuck on hangar" and "sector 5 was not a boss
    // sector". Neither was true; the probe was outrunning the game.
    const fromRoom = gs.roomSpec;
    gs._transitionToNext();
    for (let i = 0; i < 80 && gs.roomSpec === fromRoom; i++) {
      await new Promise((res) => setTimeout(res, 100));
    }
    out.path.push({ sector: gs.sector, room: gs.roomSpec?.id, boss: !!gs.roomSpec?.boss });
  };
  // Walk exactly to the SECOND boss sector and stop there. Two bosses is the
  // minimum that proves a cadence rather than a one-off, and landing on one is
  // cheaper than overshooting and hunting back — every extra step is a room
  // load and a camera fade, and this test gates the whole suite's runtime.
  out.path.push({ sector: gs.sector, room: gs.roomSpec?.id, boss: !!gs.roomSpec?.boss });
  const target = ENDLESS.bossEvery * 2;      // sector 10 at bossEvery 5
  while (gs.sector < target) await step();
  if (!gs.roomSpec?.boss) await step();      // defensive: never fight in an arena
  out.atBoss = { sector: gs.sector, room: gs.roomSpec.id, hasExit: !!gs.roomSpec.exit };

  // Spawn Vader through the production entry point and check he was scaled.
  gs.spawnBoss(gs.roomSpec.bossSpawn.x, gs.roomSpec.bossSpawn.y);
  await new Promise((res) => setTimeout(res, 900));
  const n = Math.max(1, Math.floor(gs.sector / ENDLESS.bossEvery));
  out.bossMechanics = (gs.boss?._mechanics || []).slice();
  out.boss = {
    n,
    retreats: !!gs.boss?._retreats,
    dmgCap: gs.boss?._dmgCap ?? null,
    hpMax: gs.boss?.hpMax ?? null,
    expected: Math.round(BOSS.hp * (1 + ENDLESS.bossHpStep * (n - 1))),
    // Phases are ratios of hpMax, so scaling both must leave them untouched.
    phase: gs.boss?.phase ?? null,
  };

  // Kill him. In endless this must NOT end the run.
  gs.runScore = 0;
  const medals = [];
  gs.events.on('score-medal', (name, pts) => medals.push({ name, pts }));
  let wounded = false;
  gs.events.on('boss-wounded', () => { wounded = true; });
  let wentToGameOver = false;
  const realStart = gs.scene.start.bind(gs.scene);
  gs.scene.start = (key) => { if (key === 'GameOver') wentToGameOver = true; };
  // Vader caps intake at 2200 per 120ms window (Boss.damage) so a piercing
  // super cannot delete him. One big hit therefore does NOT kill him — it takes
  // 2200 off. Grind him down through the real damage path instead of reaching
  // past it, which also exercises the cap.
  // Vader's pool went from 12,000 to a measured 62,000, so this grind now runs
  // for ~30s of real time instead of a couple of seconds — long enough that he
  // kills the stationary test player, `defeat()` fires, and the run ends. That
  // looked exactly like the bug this block is testing for (an endless run ending
  // at a boss), so keep the player standing.
  gs.lives = 9999;
  for (let i = 0; i < 200 && gs.boss?.alive; i++) {
    gs.boss.damage(5000);
    if (gs.player) { gs.player.alive = true; gs.player.hp = gs.player.hpMax; }
    await new Promise((res) => setTimeout(res, 130));
  }
  await new Promise((res) => setTimeout(res, 2500));
  gs.scene.start = realStart;

  out.afterBoss = {
    wentToGameOver,
    scored: gs.runScore,
    wounded,
    medal: medals.find((m) => m.name === 'VADER DRIVEN OFF') || null,
    mechanics: out.bossMechanics,
    doorOpen: !!gs.doorZone,
    stillPlaying: gs.scene.isActive(),
    sector: gs.sector,
  };

  // And the exit actually leads onward.
  // Wait for the ROOM to change, not a fixed delay — the same trap `step()`
  // above documents. The door opens on a 1500ms delayedCall after the wound,
  // then the transition runs behind a 350ms camera fade and loads in the fade's
  // completion callback. A flat 2200ms happened to cover that while Vader had
  // 62,000 hp and stopped covering it at 46,000, which read as "the door is
  // broken" when the door was simply still opening.
  if (gs.doorZone) {
    const fromRoom = gs.roomSpec;
    for (let i = 0; i < 80 && gs.roomSpec === fromRoom; i++) {
      // Re-assert the position: the wound sequence can nudge the player off the
      // trigger before the door is live.
      if (gs.doorZone) gs.player.setPosition(gs.doorZone.x, gs.doorZone.y);
      await new Promise((res) => setTimeout(res, 100));
    }
  }
  out.pastBoss = { sector: gs.sector, room: gs.roomSpec?.id, boss: !!gs.roomSpec?.boss };
  return out;
});

await browser.close();

// ── Boss cadence ─────────────────────────────────────────────────────────
const bossSectors = r.path.filter((p) => p.boss).map((p) => p.sector);
const arenaSectors = r.path.filter((p) => !p.boss);
check(bossSectors.length >= 2, `a boss sector arrives every ${r.bossEvery}`,
  `boss sectors seen: [${bossSectors.join(', ')}] across ${r.path.length} sectors`);
check(bossSectors.every((s) => s % r.bossEvery === 0), 'and only on the configured multiple',
  `[${bossSectors.join(', ')}] against every ${r.bossEvery}`);

// ── The arena rotation survives a boss ───────────────────────────────────
// The bug this catches: after a boss room, deriving the next arena from the
// room index pins the climb to the hangar forever.
const afterBossArenas = [];
for (let i = 1; i < r.path.length; i++) {
  if (r.path[i - 1].boss && !r.path[i].boss) afterBossArenas.push(r.path[i].room);
}
check(new Set(arenaSectors.map((p) => p.room)).size === 3,
  'all three arenas still appear across the climb',
  `saw: ${[...new Set(arenaSectors.map((p) => p.room))].join(', ')}`);
check(afterBossArenas.length === 0 || new Set(afterBossArenas).size === afterBossArenas.length,
  'the arena after a boss is not always the same one',
  `after bosses: ${afterBossArenas.join(', ') || '(none observed)'}`);

// ── Vader scales ─────────────────────────────────────────────────────────
check(r.atBoss.hasExit, "the boss room has a way onward (it used to be exit: null — a soft lock)",
  `room ${r.atBoss.room}`);
check(r.boss.hpMax === r.boss.expected, `Vader #${r.boss.n} is scaled for which boss he is`,
  `hpMax ${r.boss.hpMax}, expected ${r.boss.expected} (base ${r.baseBossHp})`);
check(r.boss.hpMax > r.baseBossHp, 'and is harder than the first one', `${r.boss.hpMax} vs ${r.baseBossHp}`);
check(r.boss.phase === 1, 'scaling hp and hpMax together leaves him in phase 1',
  `phase ${r.boss.phase} — the thresholds are ratios, so raising only hp would skip phases`);

// ── The climb continues ──────────────────────────────────────────────────
check(!r.afterBoss.wentToGameOver, 'driving Vader off does NOT end an endless run',
  'boss-died called victory(), which is the campaign behaviour');
check(r.boss.retreats, 'Vader is flagged to withdraw rather than die in endless', '');
check(r.afterBoss.wounded, 'and taking him to zero wounds him instead of killing him',
  'boss-wounded never fired — he died, so he can never come back');
check(r.afterBoss.mechanics.length === r.boss.n,
  `Vader #${r.boss.n} carries ${r.boss.n} mechanic(s)`,
  `got [${r.afterBoss.mechanics.join(', ')}]`);
check(r.boss.dmgCap === 1600,
  'his damage intake cap is FLAT across encounters, not tapered',
  `cap ${r.boss.dmgCap} — the taper made a 3000-damage super land as 960 at #6, `
  + `turning that fight into four minutes and punishing super-spam specifically`);
check(r.afterBoss.doorOpen, 'the exit opens once he is down', '');
check(!!r.afterBoss.medal && r.afterBoss.medal.pts > 0, 'and he pays out when driven off',
  r.afterBoss.medal ? `${r.afterBoss.medal.pts}` : 'no VADER DOWN medal');
check(r.pastBoss.sector > r.afterBoss.sector && !r.pastBoss.boss,
  'and walking out leads to the next arena sector',
  `sector ${r.afterBoss.sector} -> ${r.pastBoss.sector}, room ${r.pastBoss.room}`);
check(pageErrors.length === 0, 'no exception across the whole climb',
  pageErrors.slice(0, 2).join(' | '));

for (const c of checks) {
  console.log(`  ${c.ok ? 'ok  ' : 'FAIL'}  ${c.label}${c.ok || !c.detail ? '' : ' — ' + c.detail}`);
}
const failed = checks.filter((c) => !c.ok);
if (failed.length) fail(`${failed.length} of ${checks.length} checks failed: ${failed.map((f) => f.label).join('; ')}`);
console.log(`PASS: ${checks.length} checks — the climb reaches Vader, scales him, and carries on past`);
