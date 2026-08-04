// Run scoring: kill values, the chain multiplier, and the wave-clear bonuses.
//
// Score is the spine the rest of the progression work hangs off — rank, medals,
// risk contracts and credits are all planned to pay out in these points — so a
// silent regression here quietly breaks every one of them at once.
//
// All logic assertions driven through the real entry points (`addScore`,
// `scoreForEnemy`, `enemy.damage`, `_awardWaveBonuses`); nothing here depends on
// frame timing, so unlike smoke-pathing it can gate.
//
// The trap this file exists to guard: there are TWO systems in this codebase
// that were both called "combo". Player.accuracyMult is a HIT streak that
// resets on a miss and speeds up meter charge; GameScene._comboCount is a
// CHAIN-KILL streak within a 2s window. Score keys off the chain. A refactor
// that "unifies" them would leave every assertion below passing on the wrong
// quantity, so the multiplier checks drive _comboCount explicitly.

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
page.on('pageerror', (e) => fail(`page error: ${e}`));

await page.goto(URL);
await page.waitForTimeout(4500);
await page.mouse.click(360, 640);
await page.waitForTimeout(800);
await page.evaluate(() => {
  const t = window.game?.scene?.getScene('Title');
  if (t?.sys?.isActive()) t.scene.start('Game');
});
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(1500);

const r = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { ROOMS } = await import('/src/data/rooms.js');
  const { SCORE } = await import('/src/config.js');
  const out = { cfg: { grunt: SCORE.points.grunt, chainMax: SCORE.chainMax, chainStep: SCORE.chainStep } };

  gs.loadRoom(ROOMS[0]);
  await new Promise((res) => setTimeout(res, 1200));

  // ── addScore is the only writer ────────────────────────────────────────
  gs.runScore = 0;
  let events = 0;
  const onScore = () => events++;
  gs.events.on('score-changed', onScore);
  gs.addScore(500);
  gs.addScore(0);        // must be a no-op, not a 0-point event
  gs.addScore(-100);     // and neither must a negative
  out.afterAdds = gs.runScore;
  out.addEvents = events;

  // ── Per-type values and the elite multiplier ───────────────────────────
  // Built as plain objects rather than real spawns: scoreForEnemy reads only
  // enemyType/_elite/_miniBoss, and a real arena would be ticking the chain
  // counter underneath the measurement.
  gs._comboCount = 1;
  out.byType = {};
  for (const t of ['grunt', 'shooter', 'bomber', 'shielded', 'sniper', 'swarmling']) {
    out.byType[t] = gs.scoreForEnemy({ enemyType: t });
  }
  out.expectByType = { ...SCORE.points };
  out.elite = gs.scoreForEnemy({ enemyType: 'grunt', _elite: true });
  out.miniBoss = gs.scoreForEnemy({ enemyType: 'grunt', _miniBoss: true });
  // A mini-boss is also an elite in practice — the flat value must still win.
  out.miniBossElite = gs.scoreForEnemy({ enemyType: 'sniper', _elite: true, _miniBoss: true });
  out.unknownType = gs.scoreForEnemy({ enemyType: 'nosuchtype' });

  // ── The chain multiplier ───────────────────────────────────────────────
  out.chain = [];
  for (const n of [1, 2, 3, 5, 100]) {
    gs._comboCount = n;
    out.chain.push({ n, mult: gs.chainMult(), pts: gs.scoreForEnemy({ enemyType: 'grunt' }) });
  }
  gs._comboCount = 1;

  // ── A real kill pays at the multiplier it just earned ──────────────────
  // The ordering matters: enemy-died calls _tickKillCombo BEFORE scoring, so
  // the kill that takes the chain to x2 must itself be paid at x2, matching the
  // "x2!" the player sees on the same frame. Scoring first would pay the
  // previous multiplier and the numbers would disagree with the splash.
  gs.loadRoom(ROOMS[0]);
  await new Promise((res) => setTimeout(res, 1200));
  gs.runScore = 0;
  gs._comboCount = 0;
  gs._lastKillTime = -99999;
  const victims = gs.enemies.getChildren().filter((e) => e.alive).slice(0, 3);
  out.chainKills = [];
  for (const v of victims) {
    const before = gs.runScore;
    const type = v.enemyType;
    v.damage(999999);
    await new Promise((res) => setTimeout(res, 200));
    out.chainKills.push({ type, gained: gs.runScore - before, combo: gs._comboCount });
  }

  // ── Wave bonuses ───────────────────────────────────────────────────────
  // FLAWLESS must mean "nothing touched you". An ordinary wave clear hands out
  // a 300 shield, so if the damage tally were taken after shield absorption the
  // bonus would be free on almost every wave — that is the case below.
  gs.runScore = 0;
  gs._waveDamage = 0;
  gs._waveStartedAt = gs.time.now;
  const medals = [];
  const onMedal = (name, pts) => medals.push({ name, pts });
  gs.events.on('score-medal', onMedal);
  gs._awardWaveBonuses();
  out.cleanWave = { score: gs.runScore, medals: medals.slice() };

  medals.length = 0;
  gs.runScore = 0;
  gs.player.shieldHp = 500;
  gs.player.hp = gs.player.hpMax;
  gs.player.lastHurtAt = -99999;
  gs.player.damage(120);            // fully absorbed by the shield
  out.shieldAte = { shield: gs.player.shieldHp, hp: gs.player.hp, waveDamage: gs._waveDamage };
  gs._waveStartedAt = gs.time.now;
  gs._awardWaveBonuses();
  out.shieldedWave = { score: gs.runScore, medals: medals.slice() };

  // Speed bonus decays with a slow clear and is gone entirely past 2x.
  medals.length = 0;
  gs.runScore = 0;
  gs._waveDamage = 999;
  gs._waveStartedAt = gs.time.now - (SCORE.waveSpeedSecs * 2200);
  gs._awardWaveBonuses();
  out.slowWave = { score: gs.runScore, medals: medals.slice() };
  gs.events.off('score-medal', onMedal);
  gs.events.off('score-changed', onScore);

  out.expect = {
    waveClear: SCORE.waveClear, flawless: SCORE.waveFlawless,
    speed: SCORE.waveSpeed, eliteMult: SCORE.eliteMult, miniBoss: SCORE.miniBoss,
  };

  // ── Medals queue rather than overwrite ─────────────────────────────────
  // _awardWaveBonuses can emit FLAWLESS and FAST CLEAR in the same call, and a
  // room clear adds a third. They share one text object in the HUD, so without
  // a queue the last one silently ate the others — a perfect wave showed only
  // its speed bonus. Spy on the renderer rather than the emitter, because the
  // emitter was never the broken half.
  const hud = window.game.scene.getScene('HUD');
  // Wait for the lane to go idle first. The wave-bonus calls above emitted
  // several medals of their own and they drain on a timer, so measuring while
  // that is still in flight reads THEIR names and counts, not ours. At ~20fps
  // headless a 1000ms delayedCall resolves nearer 1.5-2s, hence the long bound.
  for (let i = 0; i < 120 && (hud._medalShowing || (hud._medalQueue || []).length); i++) {
    await new Promise((res) => setTimeout(res, 100));
  }
  const rendered = [];
  const realRender = hud._renderMedal.bind(hud);
  hud._renderMedal = (name, pts, col) => { rendered.push(name); return realRender(name, pts, col); };
  hud.showMedal('ONE', 1, '#fff');
  hud.showMedal('TWO', 2, '#fff');
  hud.showMedal('THREE', 3, '#fff');
  out.medalsImmediate = rendered.slice();
  await new Promise((res) => setTimeout(res, 2600));
  out.medalsRendered = rendered.slice();
  hud._renderMedal = realRender;

  // ── The score reaches the end-of-run summary ───────────────────────────
  // GameScene builds the stats object victory()/defeat() hand to GameOverScene.
  // Score being tracked but not forwarded would be invisible until you died.
  gs.runScore = 4242;
  let handed = null;
  const realStart = gs.scene.start.bind(gs.scene);
  gs.scene.start = (key, data) => { handed = { key, data }; };
  gs.defeat();
  gs.scene.start = realStart;
  out.handedToGameOver = handed?.data?.stats?.score ?? null;

  return out;
});

// ── GameOver panel layout ────────────────────────────────────────────────
// Adding the score line pushed the stat rows and the RETRY button through each
// other, and a six-figure endless score ran "NEW RECORD" straight over the
// digits. Every assertion in this file passed on that build — the failure was
// purely geometric, so it needs a geometric check. Bounds are measured from the
// live scene, at the widest score the game can realistically produce.
const layout = await page.evaluate(async () => {
  window.game.scene.getScene('Game').scene.start('GameOver', {
    win: false,
    mode: 'endless',
    stats: { clearTime: 742000, kills: 486, damageTaken: 5210, maxCombo: 2, score: 9876543, sector: 12 },
  });
  await new Promise((res) => setTimeout(res, 1600));
  const go = window.game.scene.getScene('GameOver');
  const texts = go.children.list.filter((o) => o.type === 'Text' && o.text && o.visible);
  const box = (o) => { const b = o.getBounds(); return { t: o.text, x: b.x, y: b.y, r: b.right, b: b.bottom }; };
  const find = (frag) => { const o = texts.find((t) => t.text.includes(frag)); return o ? box(o) : null; };
  return {
    all: texts.map(box),
    score: find('SCORE'),
    record: find('NEW RECORD'),
    retry: find('RETRY'),
    menu: find('MAIN MENU'),
    rows: ['SECTOR REACHED', 'KILLS:', 'CHARGE PEAK', 'DAMAGE TAKEN'].map(find),
    viewH: window.game.scale.height,
  };
});

await browser.close();

const overlaps = (a, b) => !!a && !!b && a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b;

check(!!layout.score && !!layout.record, 'the score line and its record tag both render',
  `score ${!!layout.score}, record ${!!layout.record}`);
check(!overlaps(layout.score, layout.record),
  'a seven-figure score does not collide with the NEW RECORD tag',
  layout.score && layout.record
    ? `score ends x=${Math.round(layout.score.r)}, tag starts x=${Math.round(layout.record.x)}`
    : 'one of them is missing');
check(layout.rows.every((r) => r && !overlaps(r, layout.retry)),
  'no stat row runs through the RETRY button',
  layout.rows.map((r, i) => (r && overlaps(r, layout.retry) ? `row ${i} collides` : '')).filter(Boolean).join(', '));
check(!overlaps(layout.score, layout.retry) && !overlaps(layout.retry, layout.menu),
  'the buttons clear the stats card and each other',
  `retry y ${layout.retry ? Math.round(layout.retry.y) : '?'}, menu y ${layout.menu ? Math.round(layout.menu.y) : '?'}`);
check(layout.all.every((t) => t.b <= layout.viewH + 1), 'nothing is pushed off the bottom of the screen',
  layout.all.filter((t) => t.b > layout.viewH + 1).map((t) => t.t).join(', '));

// ── addScore ─────────────────────────────────────────────────────────────
check(r.afterAdds === 500, 'addScore accumulates, and ignores zero/negative awards',
  `runScore ${r.afterAdds}, expected 500`);
check(r.addEvents === 1, 'only a real award emits score-changed',
  `${r.addEvents} events from 3 addScore calls (2 of them no-ops)`);

// ── Values ───────────────────────────────────────────────────────────────
for (const [t, v] of Object.entries(r.byType)) {
  check(v === r.expectByType[t], `${t} is worth its configured points at x1`,
    `got ${v}, config says ${r.expectByType[t]}`);
}
check(r.byType.sniper > r.byType.shooter && r.byType.swarmling < r.byType.grunt,
  'points are threat-weighted, not HP-weighted',
  `sniper ${r.byType.sniper} vs shooter ${r.byType.shooter}, swarmling ${r.byType.swarmling} vs grunt ${r.byType.grunt}`);
check(r.elite === r.cfg.grunt * r.expect.eliteMult, 'an elite is worth the configured multiple',
  `${r.elite} vs ${r.cfg.grunt} x${r.expect.eliteMult}`);
check(r.miniBoss === r.expect.miniBoss && r.miniBossElite === r.expect.miniBoss,
  'a mini-boss is a flat value, and being an elite too does not stack on it',
  `miniBoss ${r.miniBoss}, elite+miniBoss ${r.miniBossElite}, expected ${r.expect.miniBoss}`);
check(r.unknownType === r.cfg.grunt, 'an untyped enemy falls back to grunt rather than scoring 0 or NaN',
  `got ${r.unknownType}`);

// ── Chain multiplier ─────────────────────────────────────────────────────
const chainAt = (n) => r.chain.find((c) => c.n === n);
check(chainAt(1).mult === 1, 'a lone kill scores at x1', `got x${chainAt(1).mult}`);
check(Math.abs(chainAt(3).mult - (1 + r.cfg.chainStep * 2)) < 1e-9,
  'the multiplier steps with the chain', `x${chainAt(3).mult} at 3 kills`);
check(chainAt(100).mult === r.cfg.chainMax, 'the multiplier caps',
  `x${chainAt(100).mult} at a 100 chain, cap is x${r.cfg.chainMax}`);
check(chainAt(5).pts === Math.round(r.cfg.grunt * chainAt(5).mult),
  'kill points are the base times the live multiplier',
  `${chainAt(5).pts} at x${chainAt(5).mult}`);

// ── A real kill ──────────────────────────────────────────────────────────
check(r.chainKills.length >= 2, 'the probe actually killed something',
  `${r.chainKills.length} kills recorded`);
check(r.chainKills.every((k) => k.gained > 0), 'every kill awards points',
  JSON.stringify(r.chainKills));
if (r.chainKills.length >= 2) {
  const [a, b] = r.chainKills;
  check(b.combo === 2 && b.gained > a.gained,
    'a chained kill pays more than the one that started the chain',
    `first ${a.gained} (combo ${a.combo}), second ${b.gained} (combo ${b.combo})`);
}

// ── Wave bonuses ─────────────────────────────────────────────────────────
const names = (m) => m.map((x) => x.name).join(',');
check(r.cleanWave.score === r.expect.waveClear + r.expect.flawless + r.expect.speed,
  'an untouched fast clear pays clear + flawless + full speed',
  `${r.cleanWave.score}, expected ${r.expect.waveClear + r.expect.flawless + r.expect.speed}`);
check(r.cleanWave.medals.some((m) => m.name === 'FLAWLESS'), 'FLAWLESS is announced',
  `medals: ${names(r.cleanWave.medals)}`);

check(r.shieldAte.hp === 1000 || r.shieldAte.waveDamage > 0,
  'damage absorbed by the shield still counts against the wave',
  `shield left ${r.shieldAte.shield}, hp ${r.shieldAte.hp}, wave damage ${r.shieldAte.waveDamage}`);
check(!r.shieldedWave.medals.some((m) => m.name === 'FLAWLESS'),
  'a hit the shield ate breaks FLAWLESS (it is granted on most wave clears)',
  `medals: ${names(r.shieldedWave.medals)}`);

check(r.slowWave.score === r.expect.waveClear,
  'past twice the target time the speed bonus is gone, leaving only the clear',
  `${r.slowWave.score}, expected ${r.expect.waveClear}`);
check(!r.slowWave.medals.some((m) => m.name === 'FAST CLEAR'), 'and FAST CLEAR is not announced',
  `medals: ${names(r.slowWave.medals)}`);

// ── Medals ───────────────────────────────────────────────────────────────
check(r.medalsImmediate.length === 1, 'medals emitted together do not stack on screen at once',
  `${r.medalsImmediate.length} rendered on the same tick: ${r.medalsImmediate.join(',')}`);
check(r.medalsRendered.join(',') === 'ONE,TWO,THREE',
  'every medal is shown in turn instead of the last one eating the rest',
  `rendered: ${r.medalsRendered.join(',') || '(none)'}`);

// ── Reaches the summary ──────────────────────────────────────────────────
check(r.handedToGameOver === 4242, 'the run score is handed to GameOverScene',
  `got ${r.handedToGameOver}`);

for (const c of checks) {
  console.log(`  ${c.ok ? 'ok  ' : 'FAIL'}  ${c.label}${c.ok || !c.detail ? '' : ' — ' + c.detail}`);
}
const failed = checks.filter((c) => !c.ok);
if (failed.length) fail(`${failed.length} of ${checks.length} checks failed: ${failed.map((f) => f.label).join('; ')}`);
console.log(`PASS: ${checks.length} checks — kills, chain multiplier and wave bonuses all score`);
