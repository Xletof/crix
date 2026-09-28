// THE VANGUARD SCREEN — an encounter role for the Shielded. STRUCTURE ONLY.
//
// Handset evidence (the matched no-Captain VANGUARD): a shield-only tail
// stalled, because a blocked frontal shot gives nothing and at the stock
// ~290px hold ordinary footwork cannot out-turn the shield. The candidate
// answer is GEOMETRY — a VANGUARD shield closes to ~140px — and this file
// proves only the structure of that: who gets the role, where he actually
// stops, that he resumes and does not chatter, and that nothing else moved.
//
// It asserts nothing about whether flanking is now fun, whether the tail is
// fixed or whether the formation reads. Those are handset questions.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { execSync } from 'node:child_process';

const BASE = 'http://localhost:5173/';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PREV = '5a97fd4';   // the Phase B integration build the handset played

const fail = (m) => { console.error(`FAIL: ${m}`); process.exit(1); };
const checks = [];
const check = (ok, label, detail) => { checks.push({ ok: !!ok, label, detail }); };

// ── 0. The stock trooper's config is the one the handset played ───────────
{
  const sh = (cmd) => execSync(cmd, { cwd: new URL('..', import.meta.url).pathname, encoding: 'utf8' });
  const block = (src) => {
    const a = src.indexOf('  shielded: {');
    return a < 0 ? null : src.slice(a, src.indexOf('\n  },', a));
  };
  try {
    const before = block(sh(`git show ${PREV}:src/config.js`));
    const now = block(sh('cat src/config.js'));
    check(before && before === now, 'GLOBAL `ENEMY.shielded` is byte-identical to the integration build', '');
  } catch (e) {
    check(false, `${PREV} must be reachable in git to compare the Shielded config`, String(e).slice(0, 120));
  }
}

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
});

async function run(query, fn, seed = 4242) {
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  page.on('pageerror', (e) => fail(`page error (${query}): ${e}`));
  await page.goto(BASE + query);
  await page.waitForTimeout(4500);
  await page.mouse.click(360, 640);
  await page.waitForTimeout(800);
  await page.evaluate((s) => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: s }), seed);
  await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?._wave, null, { timeout: 20000 });
  await page.waitForTimeout(600);
  const out = await fn(page);
  await page.close();
  return out;
}

// ── 1. The table: role values, and nothing Phase B depends on moved ───────
const table = await run('?nodlg=1', async (page) => page.evaluate(async () => {
  const E = await import('/src/data/encounters.js');
  const { ENEMY } = await import('/src/config.js');
  return {
    screen: { ...E.VANGUARD_SCREEN },
    shielded: { ...ENEMY.shielded },
    vanguard: JSON.stringify(E.ENCOUNTERS.vanguard),
    crossfire: JSON.stringify(E.ENCOUNTERS.crossfire),
    rows: JSON.stringify(E.CHAMPION_PLACEMENTS),
  };
}));
const s = table.shielded;
check(s.hp === 560 && s.speed === 140 && s.radius === 24 && s.desiredRange === 260
  && s.fireCooldownMs === 1500 && s.bulletSpeed === 700 && s.bulletDamage === 120 && s.bulletRange === 520
  && s.shieldHalfArc === 1.35 && s.shieldTurnRate === 2.6,
  'the Shielded contract is untouched — hp, speed, range, weapon, arc, turn rate', JSON.stringify(s));
check(table.screen.holdPx < table.screen.resumePx && table.screen.resumePx < s.desiredRange,
  'the screen band is a real hysteresis band, and closer than the stock hold', JSON.stringify(table.screen));
check(table.vanguard === JSON.stringify({
  id: 'vanguard', name: 'VANGUARD', ask: 'break the facing, or go around it',
  lead: ['shielded', 'shielded', 'shooter', 'shielded', 'shooter'],
  fill: ['shielded', 'shooter', 'shooter', 'grunt'],
  gate: 'single', countMult: 0.85, maxAliveMult: 0.75, spawnRateMult: 1.20,
}), 'VANGUARD\'s composition is unchanged', table.vanguard);
check(table.crossfire === JSON.stringify({
  id: 'crossfire', name: 'CROSSFIRE', ask: 'there is no direction that is safe',
  lead: ['shooter', 'shooter', 'shooter', 'shooter'],
  fill: ['shooter', 'shooter', 'grunt', 'grunt'],
  gate: 'split', countMult: 0.85, maxAliveMult: 0.65, spawnRateMult: 1.25,
}), 'CROSSFIRE is unchanged — and carries no Shielded, so the role cannot reach it', table.crossfire);
check(table.rows === JSON.stringify([
  { arena: 'hangar', band: 'mid', wave: 1, encounter: 'vanguard', champion: 'captain', slot: 2, cost: 2, shieldSlot: 5 },
  { arena: 'hangar', band: 'late', wave: 2, encounter: 'crossfire', champion: 'captain', slot: 2, cost: 2 },
]), 'the Champion placement rows, slot and cost are unchanged (plus the one mid-VANGUARD shieldSlot)', table.rows);

// ── 2. WHO gets the role — through the real spawner ───────────────────────
//
// Every Shielded a real VANGUARD wave drains carries it; a Shielded from a
// non-VANGUARD encounter does not; `&noscreen=1` takes it away.
const drainShields = () => page => page.evaluate(async () => {
  const { setGodMode } = await import('/src/systems/debug.js');
  setGodMode(true);
  const gs = window.game.scene.getScene('Game');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  gs.arenaCfg.spawnRate = 60;
  const t0 = Date.now();
  while (gs._wavePhase === 'spawning' && Date.now() - t0 < 20000) await wait(100);
  await wait(1200);
  const sh = gs.enemies.getChildren().filter((e) => e.alive && e._archetype === 'shielded');
  // Stock and elite troopers alike: every VANGUARD Shielded, none else.
  return { enc: gs._encounter?.id, n: sh.length, screened: sh.filter((e) => !!e._screen).length };
});
const vg = await run('?nodlg=1&encdbg=1&room=hangar&sector=8&wave=2', drainShields());
check(vg.enc === 'vanguard' && vg.n >= 2 && vg.screened === vg.n,
  'EVERY Shielded a live VANGUARD drains carries the screen role', JSON.stringify(vg));
const off = await run('?nodlg=1&encdbg=1&room=hangar&sector=8&wave=2&noscreen=1', drainShields());
check(off.enc === 'vanguard' && off.n >= 2 && off.screened === 0,
  '&noscreen=1 takes it away — the old-vs-new switch works', JSON.stringify(off));

const seam = await run('?nodlg=1&encdbg=1&room=detention&sector=8', async (page) => page.evaluate(async () => {
  const { setGodMode } = await import('/src/systems/debug.js');
  const E = await import('/src/data/encounters.js');
  setGodMode(true);
  const gs = window.game.scene.getScene('Game');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const probe = async (encId) => {
    gs._encounter = encId ? E.ENCOUNTERS[encId] : null;
    const before = new Set(gs.enemies.getChildren());
    gs.spawnAtGate('shielded');
    await wait(1300);   // past the 600ms gate telegraph
    const fresh = gs.enemies.getChildren().find((e) => !before.has(e) && e._archetype === 'shielded');
    return fresh ? !!fresh._screen : 'none spawned';
  };
  const out = {
    mixed: await probe('mixed'),
    sniperNest: await probe('sniperNest'),
    none: await probe(null),
    vanguard: await probe('vanguard'),
  };
  // A room's authored / direct spawn is never part of an encounter.
  const direct = gs.spawnEnemyAt('shielded', gs.player.x + 500, gs.player.y, {});
  out.direct = !!direct._screen;
  return out;
}));
check(seam.mixed === false && seam.sniperNest === false && seam.none === false,
  'a Shielded from MIXED, another composition or no composition keeps the stock behaviour', JSON.stringify(seam));
check(seam.direct === false, 'a directly spawned Shielded keeps the stock behaviour', '');
check(seam.vanguard === true, 'the SAME seam grants it while VANGUARD is running — the probe can see the flag', JSON.stringify(seam));

// ── 3. WHERE he stops — one trooper at a time against a planted player ────
const hold = await run('?nodlg=1&encdbg=1&room=hangar&sector=8', async (page) => page.evaluate(async () => {
  const { setGodMode } = await import('/src/systems/debug.js');
  const E = await import('/src/data/encounters.js');
  setGodMode(true);
  const gs = window.game.scene.getScene('Game');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  // Off the spawner, floor cleared: one actor, one player, nothing else.
  gs.arenaActive = false;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  const p = gs.player;
  const P = { x: 760, y: 760 };
  const plant = (x, y) => { p.setPosition(x, y); p.setVelocity(0, 0); };

  // Sample on the page's own clock: distance and state flips once settled.
  // POLL FOR THE CONDITION, never a fixed wall-clock window: under suite load
  // a second of wall time can be a third of a second of game time, and a
  // fixed 9s window photographed a trooper still walking (measured: 321px
  // and moving at 204px/s). Settled = zero speed for 40 consecutive samples;
  // `capMs` is only a backstop, and the tail is those 40 samples.
  const measure = async (e, capMs) => {
    const d = () => Math.hypot(e.x - p.x, e.y - p.y);
    let flips = 0, last = e._screenHolding, still = 0;
    const t0 = Date.now();
    const trace = [];
    await wait(500);   // let the approach begin before judging "stopped"
    while (Date.now() - t0 < capMs && still < 40) {
      plant(P.x, P.y);
      if (e._screenHolding !== last) { flips++; last = e._screenHolding; }
      trace.push(Math.round(d()));
      still = Math.hypot(e.body.velocity.x, e.body.velocity.y) < 1 ? still + 1 : 0;
      await wait(50);
    }
    const tail = trace.slice(-40);
    return { final: Math.round(d()), min: Math.min(...tail), max: Math.max(...tail), flips,
      speedAtRest: Math.round(Math.hypot(e.body.velocity.x, e.body.velocity.y)) };
  };

  plant(P.x, P.y);
  const stock = gs.spawnEnemyAt('shielded', P.x + 620, P.y, {});
  const stockM = await measure(stock, 40000);
  gs._destroyEnemyFully(stock);

  plant(P.x, P.y);
  const scr = gs.spawnEnemyAt('shielded', P.x + 620, P.y, { vanguardScreen: E.VANGUARD_SCREEN });
  const scrM = await measure(scr, 40000);
  // Walk the settled window's hold flips separately from the approach.
  let flipsSettled = 0, lastH = scr._screenHolding;
  for (let i = 0; i < 40; i++) {
    plant(P.x, P.y);
    if (scr._screenHolding !== lastH) { flipsSettled++; lastH = scr._screenHolding; }
    await wait(50);
  }
  // RESUME: the player opens distance, he must close again and re-settle.
  const away = { x: P.x - 260, y: P.y };
  P.x = away.x;
  const dAfterStep = Math.round(Math.hypot(scr.x - away.x, scr.y - away.y));
  const resumeM = await measure(scr, 40000);
  return { stockM, scrM, flipsSettled, dAfterStep, resumeM, screen: { ...E.VANGUARD_SCREEN } };
}));
check(hold.stockM.final >= 255 && hold.stockM.final <= 300,
  `the STOCK Shielded holds where the handset met it (~290px): measured ${hold.stockM.final}px`, JSON.stringify(hold.stockM));
check(hold.scrM.final >= 115 && hold.scrM.final <= 150,
  `the VANGUARD screen holds in the close band (~140px): measured ${hold.scrM.final}px`, JSON.stringify(hold.scrM));
check(hold.stockM.final - hold.scrM.final >= 100,
  'the screen stands substantially closer than a stock trooper against the same planted player',
  `${hold.stockM.final} vs ${hold.scrM.final}`);
check(hold.scrM.speedAtRest === 0 && hold.scrM.max - hold.scrM.min <= 6,
  'once settled he HOLDS — no drift, no creep onto the player', JSON.stringify(hold.scrM));
check(hold.flipsSettled === 0, 'and he does not chatter across the threshold while the player stands still',
  `${hold.flipsSettled} flips`);
check(hold.dAfterStep > hold.screen.resumePx && hold.resumeM.final >= 115 && hold.resumeM.final <= 150,
  'when the player opens distance he RESUMES the advance and re-settles in the band',
  `${hold.dAfterStep} -> ${hold.resumeM.final}`);

// ── 4. THE BLOCK CONTRACT — a frontal shot still buys nothing ─────────────
const block = await run('?nodlg=1&encdbg=1&room=hangar&sector=8', async (page) => page.evaluate(async () => {
  const { setGodMode } = await import('/src/systems/debug.js');
  const E = await import('/src/data/encounters.js');
  const { PLAYER } = await import('/src/config.js');
  setGodMode(true);
  const gs = window.game.scene.getScene('Game');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  gs.arenaActive = false;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  const p = gs.player;
  p.setPosition(760, 760);
  const e = gs.spawnEnemyAt('shielded', 900, 760, { vanguardScreen: E.VANGUARD_SCREEN });
  e.fireCd = 1e9;
  await wait(2000);   // let the shield settle onto the player
  let blocks = 0;
  const ob = e.onBlock.bind(e);
  e.onBlock = () => { blocks++; ob(); };
  const snap = () => ({ hp: e.hp, sup: p.superCharge, mel: p.meleeCharge });
  const shoot = async (fx, fy) => {
    const a = Math.atan2(e.y - fy, e.x - fx);
    gs.playerBullets.fire(fx, fy, a, PLAYER.pelletSpeed, 40, 600, { owner: 'player' });
    await wait(700);
  };
  const s0 = snap();
  for (let i = 0; i < 3; i++) { p.setPosition(760, 760); await shoot(p.x + 40, p.y); }
  const s1 = snap();
  const frontalBlocks = blocks;
  // POSITIVE CONTROL: the same shot from BEHIND the shield must land, or the
  // zero above proves nothing about the rule.
  await shoot(e.x + 120, e.y);
  const s2 = snap();
  return { s0, s1, s2, frontalBlocks, screened: !!e._screen };
}));
check(block.screened && block.frontalBlocks >= 3, 'three frontal shots reached a VANGUARD screen and were blocked',
  `${block.frontalBlocks}`);
check(block.s1.hp === block.s0.hp, 'a blocked shot still does ZERO damage', JSON.stringify(block.s1));
check(block.s1.sup === block.s0.sup, 'a blocked shot still gives ZERO Super charge', `${block.s0.sup} -> ${block.s1.sup}`);
check(block.s1.mel === block.s0.mel, 'a blocked shot still gives ZERO melee charge', `${block.s0.mel} -> ${block.s1.mel}`);
check(block.s2.hp < block.s1.hp && block.s2.sup > block.s1.sup,
  'and the positive control lands from behind — hp falls and the Super charges', JSON.stringify(block.s2));

await browser.close();

for (const c of checks) {
  console.log(`  ${c.ok ? 'ok  ' : 'FAIL'}  ${c.label}${c.ok || !c.detail ? '' : ' — ' + c.detail}`);
}
console.log(`\n  stock hold ${hold.stockM.final}px · screen hold ${hold.scrM.final}px (settled ${hold.scrM.min}-${hold.scrM.max}) · resume ${hold.dAfterStep} -> ${hold.resumeM.final}px`);
const failed = checks.filter((c) => !c.ok);
if (failed.length) fail(`${failed.length} of ${checks.length} checks failed: ${failed.map((f) => f.label).join('; ')}`);
console.log(`PASS: ${checks.length} checks — VANGUARD shields close to a screen; nothing else moved`);
