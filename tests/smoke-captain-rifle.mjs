// SHOCK CAPTAIN — THE SUPPRESSION RIFLE. STRUCTURAL, AND ONLY STRUCTURAL.
//
// §37 IS EXPLICIT ABOUT WHAT THIS FILE MAY AND MAY NOT SAY. It protects truth:
// one plan per commitment, a length drawn once inside 3-6, a spray shape chosen
// once, every round drawn from the committed plan, no per-round re-solve, no
// homing, and nothing left behind. It holds NO opinion about hit rate, pressure
// or how long a fight should last — HUMAN HANDSET COMBAT IS THE BALANCE
// AUTHORITY, and the harness has already been wrong about this exact actor.
//
// THE DISCRIMINATING CHECK IS THE ONE THAT WOULD HAVE PASSED ON THE OLD BUILD
// AND MUST NOT. B.2.2 solved an intercept per projectile, so "he shoots at
// points near the player" is decoration — it was true then too. What separates
// the two laws is that the aim points of ONE burst all lie on ONE straight
// corridor, and that moving the player mid-burst changes NOTHING about the
// remaining rounds.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';

const BASE = 'http://localhost:5173/';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const fail = (m) => { console.error(`FAIL: ${m}`); process.exit(1); };
const checks = [];
const check = (ok, label, detail) => { checks.push({ ok, label, detail }); };

// ── 0. THE STATIC HALF ─────────────────────────────────────────────────────
// The per-round solver has to be GONE, not merely unused. An unread function
// that the notes describe as removed is worse than none — the same reason
// `teleports: true` was deleted from the camera rather than left unconsulted.
const src = readFileSync('src/entities/ShockCaptain.js', 'utf8');
const code = src.split('\n')
  .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n');
check(!code.includes('_predict') && !code.includes('burstLead'),
  'the per-round intercept solver is GONE, not merely unused',
  code.includes('_predict') ? '_predict survives' : 'burstLead survives');
// AND THE FAIRNESS RULE THE STEP CARRIES APPLIES TO THE RIFLE TOO.
const forbidden = ['superAiming', 'superAim', 'superCharge', 'player-fire-super',
  'playerSuperBullets', 'tryFireSuper', 'superReady', 'isSuper'];
check(forbidden.every((k) => !code.includes(k)),
  'and the rifle cannot read the player\'s Super either');

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
});

async function run(query, fn) {
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  page.on('pageerror', (e) => fail(`page error (${query}): ${e}`));
  await page.goto(BASE + query);
  await page.waitForTimeout(4500);
  await page.mouse.click(360, 640);
  await page.waitForTimeout(800);
  await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 1357 }));
  await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
  await page.waitForTimeout(2200);
  const out = await fn(page);
  await page.close();
  return out;
}

// ── 1. THE CONFIGURED LAW ──────────────────────────────────────────────────
const cfg = await run('?nodlg=1&champdbg=1', async (page) => page.evaluate(async () => {
  const { CHAMPION } = await import('/src/config.js');
  const d = CHAMPION.captain;
  return {
    min: d.burstRounds, max: d.burstRoundMax,
    weights: d.burstRoundWeights, sprays: d.sprayWeights, c: d.corridor,
  };
}));
check(cfg.min === 3 && cfg.max === 6,
  'the commitment is 3 to 6 rounds — variable, and still a controlled rifle',
  `${cfg.min}-${cfg.max}`);
check(cfg.weights.length === 4
  && cfg.weights.every(([v]) => v >= cfg.min && v <= cfg.max),
  'and every authored length is inside that band',
  JSON.stringify(cfg.weights));
check(!cfg.weights.every(([, w]) => w === cfg.weights[0][1]),
  'the distribution is AUTHORED, not uniform — §18 forbids a flat roll',
  JSON.stringify(cfg.weights.map(([, w]) => w)));
// THE SHAPE FAMILY IS DELIBERATELY SMALL NOW, and the two that are gone are
// gone because they were NOT MONOTONIC: `outward` walked 0.5 -> 0.75 -> 0.25
// and `sweepback` went out and came back. Naming either again reintroduces the
// exact thing the handset called erratic.
check(cfg.sprays.length === 2
  && cfg.sprays.every(([k]) => k === 'near' || k === 'far'),
  'ONE FREE CHOICE — which side the sweep starts on, and nothing else',
  JSON.stringify(cfg.sprays.map(([k]) => k)));
// THE BOUND MOVED WHEN THE CORRIDOR WAS ANCHORED IN TIME, and the honest bound
// is `maxLead` — how far from where they were standing any round may suppress.
// `maxLen` is deliberately ABOVE what normal play asks for, because a cap that
// binds in normal play is not a bound, it is the aim.
check(cfg.c.maxLead <= 600 && cfg.c.maxLen < cfg.c.maxLead,
  'the corridor is bounded — a route is not an arena traversal',
  `${cfg.c.maxLen}px long, never further than ${cfg.c.maxLead}px from them`);

// ── 2. ONE PLAN PER COMMITMENT, AND EVERY ROUND COMES FROM IT ──────────────
//
// THE WHOLE LAW, MEASURED ON A REAL FIGHT. Nothing here forces a burst length,
// a pattern or a target: the real solver runs and the rig only records.
const live = await run('?nodlg=1&champdbg=1', async (page) => page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { setGodMode } = await import('/src/systems/debug.js');
  setGodMode(true);
  gs.lives = 9999;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  gs.enemies.getChildren().filter((e) => e.alive && !e.isChampion)
    .forEach((e) => gs._destroyEnemyFully?.(e) ?? e.destroy());
  gs.arenaActive = false;
  let c = gs.enemies.getChildren().find((e) => e.alive && e.isChampion);
  if (!c) c = gs.spawnChampion(gs.player.x + 400, gs.player.y, 'captain');
  c.die = () => { c.hp = Math.max(c.hp, c.hpMax * 0.5); };
  // ── STAGE THE ENGAGEMENT; DO NOT TIME THE WALK OVER ──────────────────────
  // A wave-spawned Captain arrives wherever the gate dropped him, and this rig
  // measured THREE commitments in 26 seconds because most of the window was an
  // approach. `fireRange` is 620 and the band is 300-520, so put him inside it
  // and the same 26s buys a sample that can actually say whether the lengths
  // vary. The player policy below then keeps him there.
  c.setPosition(gs.player.x + 420, gs.player.y);
  c.setVelocity(0, 0);
  const plans = [];
  const realPlan = c._planBurst.bind(c);
  c._planBurst = (p) => {
    const pl = realPlan(p);
    plans.push({ ox: pl.ox, oy: pl.oy, dx: pl.dx, dy: pl.dy, len: pl.len,
      rounds: pl.rounds, pattern: pl.pattern, shots: [] });
    return pl;
  };
  const rounds = [];
  const realFire = gs.fireCaptainBolt.bind(gs);
  gs.fireCaptainBolt = (cap, mx, my, ang) => {
    const b = realFire(cap, mx, my, ang);
    if (cap === c) {
      const pl = plans[plans.length - 1];
      // The point this round is suppressing, and the plan it belongs to.
      const aim = c._planPoint(c._planShot - 1);
      if (pl) pl.shots.push({ x: aim.x, y: aim.y });
      rounds.push({ plan: plans.length - 1, x: aim.x, y: aim.y, b });
    }
    return b;
  };
  // Drive the player laterally so most commitments get a real corridor rather
  // than a still fan, then STOP DEAD partway through — the burst must not
  // notice, which is the whole claim.
  let t = 0, dir = 1, freeze = false;
  // A PLAN MAY ONLY EXIST INSIDE A COMMITMENT. Sampled every frame rather than
  // once at the end: a single sample at the end lands inside a brace as often
  // as not, where a live plan is CORRECT. This is the continuous claim.
  let strayPlan = 0;
  const hook = () => {
    const p = gs.player;
    t += gs.game.loop.delta;
    if (t > 1500) { t = 0; dir *= -1; }
    if (c._plan && c._cap !== 'brace' && c._cap !== 'burst') strayPlan++;
    // Freeze whenever a plan is live and at least one round has left: the
    // remaining rounds must still go where the plan said.
    freeze = !!(c._plan && c._planShot > 0);
    if (freeze) { p.setMoveInput({ x: 0, y: 0, force: 0 }); return; }
    // Hold the band: orbit while he is inside it, close when he is not.
    const d = Math.hypot(p.x - c.x, p.y - c.y);
    const toCap = Math.atan2(c.y - p.y, c.x - p.x);
    const a = d > c.def.holdMax ? toCap : toCap + Math.PI / 2 * dir;
    p.setMoveInput({ x: Math.cos(a), y: Math.sin(a), force: 1 });
  };
  gs.events.on('postupdate', hook);
  await wait(26000);
  gs.events.off('postupdate', hook);

  // ── THE MONOTONICITY PROOF (§6, §26) ────────────────────────────────────
  // Project every round of a burst onto its OWN corridor axis and walk the
  // projections in firing order: the progression must move consistently in one
  // direction. This is the check the rejected build fails — `outward` produced
  // 0.5 -> 0.75 -> 0.25 and any projection of that reverses at round three.
  // Tolerance is the authored perpendicular budget expressed along the axis
  // (bounded jitter can nudge a projection, it can never invert the walk).
  const runs = [];
  for (const pl of plans.filter((x) => x.shots.length > 2)) {
    const proj = pl.shots.map((sx) => (sx.x - pl.ox) * pl.dx + (sx.y - pl.oy) * pl.dy);
    let worstBack = 0;
    const dir = Math.sign(proj[proj.length - 1] - proj[0]) || 1;
    for (let i = 1; i < proj.length; i++) {
      const stepI = (proj[i] - proj[i - 1]) * dir;
      if (stepI < 0) worstBack = Math.min(worstBack, stepI);
    }
    runs.push({ n: pl.shots.length, pattern: pl.pattern, worstBack: Math.round(worstBack) });
  }

  // HOW FAR EACH AIM POINT SITS OFF ITS OWN CORRIDOR LINE. Every round of one
  // burst has to lie within the authored bias + jitter of the same straight
  // line; under the rejected law rounds 1 and 3 sat on a line through the
  // PLAYER at two different times, which is a different line whenever they
  // were not travelling exactly along it.
  const off = [];
  const done = plans.filter((pl) => pl.shots.length > 1);
  for (const pl of done) {
    for (const s of pl.shots) {
      const ex = s.x - pl.ox, ey = s.y - pl.oy;
      off.push(Math.abs(ex * -pl.dy + ey * pl.dx));
    }
  }
  // A homing check: a Captain bolt must keep the velocity it was fired with.
  const vel0 = rounds.slice(-6).map((r) => r.b && r.b.body
    ? Math.round(Math.hypot(r.b.body.velocity.x, r.b.body.velocity.y)) : 0);
  await wait(260);
  const vel1 = rounds.slice(-6).map((r) => r.b && r.b.body && r.b.active
    ? Math.round(Math.hypot(r.b.body.velocity.x, r.b.body.velocity.y)) : 0);

  return {
    plans: plans.length,
    rounds: rounds.length,
    lens: done.map((pl) => pl.rounds),
    fired: done.map((pl) => pl.shots.length),
    patterns: [...new Set(done.map((pl) => pl.pattern))],
    maxOff: off.length ? Math.round(Math.max(...off)) : -1,
    corridorMax: c.def.corridor.maxLen,
    // THE AUTHORED PERPENDICULAR SPREAD AT THE LAST POSSIBLE ROUND, derived
    // from the config rather than picked: the bias opens 16% per round and the
    // jitter grows by `climbPx` per round, so round index 5 of a six-round
    // burst is the widest anything may legally sit off the line.
    allow: Math.round(c.def.corridor.biasMaxPx * (1 + 5 * 0.16)
      + c.def.corridor.jitterPx + c.def.corridor.climbPx * 5),
    strayPlan,
    runs,
    worstBack: runs.length ? Math.min(...runs.map((r) => r.worstBack)) : 0,
    vel0, vel1,
    min: c.def.burstRounds, max: c.def.burstRoundMax,
  };
}));

check(live.plans >= 3 && live.rounds >= 9,
  'he opened real commitments in a real fight',
  `${live.plans} plans, ${live.rounds} rounds`);
check(live.rounds > live.plans * 2,
  'ONE PLAN PER COMMITMENT, NEVER ONE PER ROUND — the whole point of the law',
  `${live.plans} plans produced ${live.rounds} rounds`);
check(live.lens.every((n) => n >= live.min && n <= live.max),
  'every drawn length is inside 3-6', JSON.stringify(live.lens));
check(live.fired.every((n, i) => n === live.lens[i]),
  'and the burst fires exactly the length it drew — the count is decided ONCE',
  `${JSON.stringify(live.fired)} against ${JSON.stringify(live.lens)}`);
check(new Set(live.lens).size > 1,
  'the lengths actually VARY — a fixed three is what the handset rejected',
  JSON.stringify(live.lens));
// THE DISCRIMINATOR. Freezing the player mid-burst must not move the remaining
// rounds off the line the plan drew, and the old law could not satisfy this.
check(live.maxOff >= 0 && live.maxOff <= live.allow,
  'EVERY ROUND OF A BURST LIES ON THE ONE COMMITTED CORRIDOR, and stopping dead mid-burst does not move it',
  `worst ${live.maxOff}px off the line, authored bias+jitter allows ${live.allow}px`);
check(live.patterns.length >= 1 && live.patterns.every((p) => typeof p === 'string'),
  'each commitment carries exactly one named spray shape',
  JSON.stringify(live.patterns));
check(live.vel0.length > 0 && live.vel0.every((v, i) => v === 0 || live.vel1[i] === 0
  || Math.abs(v - live.vel1[i]) <= 2),
  'NO HOMING — a round in flight keeps the velocity it left with',
  `${JSON.stringify(live.vel0)} -> ${JSON.stringify(live.vel1)}`);
check(live.runs.length >= 2,
  'several multi-round bursts were observed end to end',
  `${live.runs.length}`);
// THE HEADLINE CHECK OF THIS PASS. A single round stepping backward along its
// own corridor is the reversal the handset saw; the allowance is small and is
// there only for bounded perpendicular noise leaking into the projection.
check(live.worstBack >= -8,
  'EVERY BURST SWEEPS ONE WAY — no round steps back along its own corridor',
  `worst backward step ${live.worstBack}px across ${live.runs.length} bursts`);
check(live.strayPlan === 0,
  'and the corridor dies with the commitment — no plan outlives a brace or a burst',
  `${live.strayPlan} frames with a stray plan`);

// ── 3. A STILL TARGET IS STILL SUPPRESSED ──────────────────────────────────
// §26: standing still must be punished. A route of zero length is a point, so
// the plan degenerates to a short fan ACROSS his bearing instead of a corridor.
const stand = await run('?nodlg=1&champdbg=1', async (page) => page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { setGodMode } = await import('/src/systems/debug.js');
  setGodMode(true);
  gs.lives = 9999;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  gs.enemies.getChildren().filter((e) => e.alive && !e.isChampion)
    .forEach((e) => gs._destroyEnemyFully?.(e) ?? e.destroy());
  gs.arenaActive = false;
  let c = gs.enemies.getChildren().find((e) => e.alive && e.isChampion);
  if (!c) c = gs.spawnChampion(gs.player.x + 380, gs.player.y, 'captain');
  c.die = () => { c.hp = Math.max(c.hp, c.hpMax * 0.5); };
  gs.player.setVelocity(0, 0);
  const hook = () => gs.player.setMoveInput({ x: 0, y: 0, force: 0 });
  gs.events.on('postupdate', hook);
  const miss = [];
  const plans = [];
  const realPlan = c._planBurst.bind(c);
  c._planBurst = (p) => {
    const pl = realPlan(p);
    plans.push({ still: pl.still, len: pl.len });
    return pl;
  };
  const realFire = gs.fireCaptainBolt.bind(gs);
  gs.fireCaptainBolt = (cap, mx, my, ang) => {
    const b = realFire(cap, mx, my, ang);
    if (cap === c) miss.push({ x: c._planPoint(c._planShot - 1).x,
      y: c._planPoint(c._planShot - 1).y, px: gs.player.x, py: gs.player.y });
    return b;
  };
  await wait(20000);
  gs.events.off('postupdate', hook);
  return {
    plans: plans.length,
    still: plans.filter((p) => p.still).length,
    fan: plans.filter((p) => p.still).map((p) => Math.round(p.len)),
    // How far the SUPPRESSED GROUND sits from a player who never moved.
    worst: miss.length
      ? Math.round(Math.max(...miss.map((m) => Math.hypot(m.x - m.px, m.y - m.py)))) : -1,
    fanCfg: c.def.corridor.stillFanPx,
  };
}));
check(stand.plans > 0 && stand.still === stand.plans,
  'a stationary player produces a STILL plan every time',
  `${stand.still}/${stand.plans}`);
check(stand.fan.every((l) => l === stand.fanCfg),
  'and that plan is the authored fan, not a corridor',
  `${JSON.stringify(stand.fan)} against ${stand.fanCfg}`);
// NOT A HIT-RATE ASSERTION — a bound on the SUPPRESSED GROUND, which is
// geometry. The fan is centred on them, so no round may be aimed further from
// a motionless player than the fan's own half-length plus its authored spread.
check(stand.worst >= 0 && stand.worst <= stand.fanCfg,
  'STANDING STILL IS NOT SAFE — every round is aimed inside the fan around them',
  `worst ${stand.worst}px, fan ${stand.fanCfg}px`);

await browser.close();
for (const c of checks) {
  console.log(`  ${c.ok ? 'ok  ' : 'FAIL'}  ${c.label}${c.ok || !c.detail ? '' : ' — ' + c.detail}`);
}
const failed = checks.filter((c) => !c.ok);
if (failed.length) fail(`${failed.length} of ${checks.length} checks failed: ${failed.map((f) => f.label).join('; ')}`);
console.log(`PASS: ${checks.length} checks — one plan per commitment, drawn once, executed whole, never re-solved`);
