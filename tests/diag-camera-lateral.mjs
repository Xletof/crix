// DIAG — DOES LATERAL TRAVEL OPEN THE WORLD AHEAD? (Camera Phase 2A)
//
//   node tests/diag-camera-lateral.mjs
//
// The Phase 1 handset verdict was "it lags behind too much for lateral
// movement west/east. I can't see where I will be going or the enemies there."
// That is a composition complaint with a number behind it: how much of the
// 720px portrait viewport lies AHEAD of the player while they are travelling.
// This measures exactly that, with the real move stick, plus the three things
// that could make a better number a worse camera — peak lag, oscillation, and
// how long a hard reversal takes to settle.
//
// A/B THIS AGAINST THE PRE-2A BUILD. `CAMERA.leadX = 0`, `dzX = 120`,
// `stiffnessX = 13.5` is the Phase 1 camera exactly; the point of the rig is
// the difference between the two runs, not the absolute figures.
//
// Sampled on `postupdate` inside the page — `page.evaluate` polling costs
// 200-400ms a round trip and would miss most of a reversal.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const URL = 'http://localhost:5173/?nodlg=1&nofreeze=1';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const VIEW_W = 720;

const browser = await chromium.launch({ executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
page.on('pageerror', (e) => console.error('PAGE ERROR', e));

await page.goto(URL);
await page.waitForTimeout(4500);
await page.mouse.click(360, 640);
await page.waitForTimeout(800);
await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 2024 }));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(1500);

await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { ROOMS } = await import('/src/data/rooms.js');
  gs.loadRoom(ROOMS.find((r) => r.id === 'detention'));
});
await page.waitForTimeout(1400);

const cfg = await page.evaluate(async () => {
  const { CAMERA } = await import('/src/config.js');
  return { leadX: CAMERA.leadX, dzX: CAMERA.dzX, sx: CAMERA.stiffnessX, sy: CAMERA.stiffnessY };
});
console.log(`build: leadX ${cfg.leadX}  dzX ${cfg.dzX}  stiffnessX ${cfg.sx}  stiffnessY ${cfg.sy}\n`);

// THE ROOM HAS TO BE QUIET OR THIS MEASURES THE HARNESS. The bot must not die,
// a live camera punch is a live zoom write — and the arena's wave spawner is
// turned OFF, which is the one that actually bit: with waves running the page
// was down to ~12fps by the fourth station and the dash probe reported a
// 241px/s "dash". The subject is the camera, not the spawner.
const quiet = () => page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs.lives = 9999; gs.player.hp = gs.player.hpMax = 1e9;
  gs.arenaActive = false;
  for (const e of gs.enemies.getChildren().slice()) e.destroy();
  for (const g of [gs.playerBullets, gs.playerRifleBullets, gs.playerSuperBullets, ...gs.hostileBullets])
    for (const b of g.getChildren().slice()) b.setActive(false).setVisible(false);
  // AND THE CLOCKS RESTORED. `juice.js` slow-motion writes `time.timeScale` and
  // `physics.world.timeScale` (the arcade one DIVIDES, so 2.84 is a third
  // speed) and tweens them back to 1. A rig that samples while one is partly
  // restored measures a throttled game: this reported a peak dash velocity of
  // 241px/s against a 950px/s dash and 380px/s walk, and NO frames mid-dash,
  // for two whole builds before it was found. Kill the tweens first or they
  // write it straight back.
  gs.tweens.killTweensOf(gs.time);
  gs.tweens.killTweensOf(gs.physics.world);
  gs.time.timeScale = 1;
  gs.physics.world.timeScale = 1;
  if (gs._cameraPunchTween) { gs._cameraPunchTween.stop(); gs._cameraPunchTween = null; }
  gs.cameras.main.setZoom(1);
});

await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  window.__t = []; window.__rec = false;
  gs.events.on('postupdate', () => {
    if (!window.__rec) return;
    const c = gs.cameras.main, d = gs.cameraDirector, p = gs.player;
    window.__t.push([
      (p.x - c.scrollX) * c.zoom + c.x,     // player SCREEN x
      c.scrollX, d._tx, d._leadX ?? 0,
      p.body.velocity.x, p.isDashing ? 1 : 0, p.x,
    ]);
  });
});

const stick = await page.evaluate(async () => {
  const { getControl } = await import('/src/systems/controlLayout.js');
  const c = getControl('moveStick');
  return { x: c.x, y: c.y, r: c.radius };
});

async function place(x, y) {
  await quiet();
  await page.evaluate(([px, py]) => {
    const gs = window.game.scene.getScene('Game');
    gs.player.setPosition(px, py); gs.player.setVelocity(0, 0);
    gs.player._moveTargetX = 0; gs.player._moveTargetY = 0;
    gs.cameraDirector.reset(px, py);
  }, [x, y]);
  await page.waitForTimeout(400);
}

// `legs` held on ONE continuous press, so a reversal is a reversal rather than
// a release and a new grab.
async function run(label, legs, note = '') {
  await page.evaluate(() => { window.__t = []; window.__rec = true; });
  await page.mouse.move(stick.x, stick.y);
  await page.mouse.down();
  for (const [dx, dy, ms] of legs) {
    await page.mouse.move(stick.x + dx * stick.r * 1.4, stick.y + dy * stick.r * 1.4, { steps: 2 });
    await page.waitForTimeout(ms);
  }
  await page.mouse.up();
  await page.waitForTimeout(700);
  const tr = await page.evaluate(() => { window.__rec = false; return window.__t; });
  report(label, tr, note);
}

// Room width, for the clamp filter below. Detention is 1600 wide.
const ROOM_W = 1600;

function report(label, tr, note) {
  if (tr.length < 8) { console.log(`${label}: ${tr.length} frames — NOT MEASURED`); return; }
  // "Settled travel" = frames where the player is genuinely moving laterally,
  // after the lead has had time to open. The first third is the transient and
  // reporting it as the composition would flatter a slow build and a fast one
  // equally.
  //
  // AND CLEAR OF THE FRAMING CLAMP, which is the correction that made this rig
  // honest. A 3s eastward leg from mid-room crosses 1140px and ends pressed
  // against the wall, where the camera has stopped and composition is decided
  // by the clamp rather than by the lead — arcade physics blocks the position
  // but leaves the velocity, so those frames still read as "moving" and were
  // being averaged in. They reported sustained west at screen x 366, i.e. no
  // lead at all, while the diagonals (which never reach a wall) reported 304.
  const moving = tr.filter((r) => Math.abs(r[4]) > 200 && r[6] > 520 && r[6] < ROOM_W - 520);
  const settled = moving.slice(Math.floor(moving.length / 3));
  if (!settled.length) { console.log(`${label}: no frames in free travel away from the walls`); return; }
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const sx = mean(settled.map((r) => r[0]));
  const dir = Math.sign(mean(settled.map((r) => r[4]))) || 1;
  // The whole question: how much viewport lies AHEAD of the player.
  const ahead = dir > 0 ? VIEW_W - sx : sx;
  let lag = 0, osc = 0, prev = 0;
  for (let i = 1; i < tr.length; i++) {
    lag = Math.max(lag, Math.abs(tr[i][1] - tr[i][2]));
    const d = tr[i][1] - tr[i - 1][1];
    const steady = i > 3 && [1, 2, 3].every((b) => Math.sign(tr[i - b][4]) === Math.sign(tr[i][4]));
    if (Math.abs(d) > 0.5 && Math.abs(prev) > 0.5 && Math.sign(d) !== Math.sign(prev) && steady) osc++;
    if (Math.abs(d) > 0.5) prev = d;
  }
  const leadPk = Math.max(...tr.map((r) => Math.abs(r[3])));
  // SLOSH. Peak-to-peak camera travel against peak-to-peak player travel. A
  // ratio near or above 1 on a station where the player is changing direction
  // constantly means the world is moving at least as much as the player is,
  // which is what "the camera is doing a trick" feels like from the inside. It
  // is the number a tighter deadzone plus a lead can quietly ruin, and the
  // repeated-strafe station is where it would show up first.
  const pp = (a) => Math.max(...a) - Math.min(...a);
  const slosh = pp(tr.map((r) => r[1])) / Math.max(1, pp(tr.map((r) => r[6])));
  console.log(
    `${label.padEnd(24)} playerScreenX ${sx.toFixed(0).padStart(3)}`
    + `  worldAhead ${ahead.toFixed(0).padStart(3)}px`
    + `  peakLagX ${lag.toFixed(0).padStart(3)}`
    + `  peakLead ${leadPk.toFixed(0).padStart(3)}`
    + `  slosh ${slosh.toFixed(2)}`
    + `  osc ${osc}${note ? '   ' + note : ''}`,
  );
}

console.log('worldAhead = viewport pixels in front of the player during settled travel (720 wide, neutral is 360).\n');

// Staged so the whole leg is free travel: 1.9s at 380px/s is ~720px, which
// fits between the clamp exclusions at 520 and 1080.
await place(560, 700); await run('sustained east', [[1, 0, 1900]]);
await place(1040, 700); await run('sustained west', [[-1, 0, 1900]]);
await place(800, 700); await run('short strafes', [[1, 0, 260], [-1, 0, 260], [1, 0, 260], [-1, 0, 260], [1, 0, 260], [-1, 0, 260]]);
// ── DASH ───────────────────────────────────────────────────────────────────
// Fired through `tryDash()`, the real entry point. The question is whether the
// view is ALREADY open east when the dash lands, or whether the camera chases.
// A COMMITTED DASH, NOT A VAULT DASH. `tryDash` scans `coverRegistry.spots`
// within 300px and 35 degrees of the stick and, when it finds one, retargets
// the dash onto it and shortens it to the travel time — clamped to a 100ms
// FLOOR. Detention's cover is dense, so every cast here came back as a 100ms
// vault, which at the harness's ~100ms frames falls cleanly between two
// samples: three real dashes, zero frames caught, and a row that read as "the
// dash never fired". The spots are parked for this station and put straight
// back; vault framing is its own question and not this pass's.
await place(500, 700);
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  window.__spots = gs.coverRegistry?.spots || [];
  if (gs.coverRegistry) gs.coverRegistry.spots = [];
  window.__d = { n: 0, dashF: 0, lag: 0, sp: 0, minAhead: 1e9, lead: 0 };
  window.__dh = () => {
    const c = gs.cameras.main, d = gs.cameraDirector, p = gs.player;
    const sx = (p.x - c.scrollX) * c.zoom + c.x;
    window.__d.n++;
    if (p.isDashing) {
      window.__d.dashF++;
      window.__d.minAhead = Math.min(window.__d.minAhead, 720 - sx);
    }
    window.__d.lag = Math.max(window.__d.lag, Math.abs(c.scrollX - d._tx));
    window.__d.lead = Math.max(window.__d.lead, Math.abs(d._leadX ?? 0));
    window.__d.sp = Math.max(window.__d.sp, Math.abs(p.body.velocity.x));
  };
  gs.events.on('postupdate', window.__dh);
});
await page.mouse.move(stick.x, stick.y);
await page.mouse.down();
await page.mouse.move(stick.x + stick.r * 1.4, stick.y, { steps: 2 });
await page.waitForTimeout(400);
// A REFUSED CALL READS EXACTLY LIKE A FAILED ONE, so each cast reports whether
// it actually took. `tryDash` returns early on `!alive`, no charges, an
// in-flight dash or a hurt-stagger, and a rig that only reads the aftermath
// files the result under a dash that never happened — which is exactly what
// two builds of this file did.
const casts = [];
for (let i = 0; i < 3; i++) {
  casts.push(await page.evaluate(() => {
    const p = window.game.scene.getScene('Game').player;
    const before = { charges: p.dashCharges, dashing: p.isDashing, stagger: Math.round(p._hurtStaggerMs || 0), alive: p.alive };
    p.dashCharges = 2;
    p.tryDash();
    return { before, took: p.isDashing && !before.dashing, timer: Math.round(p.dashTimer || 0) };
  }));
  await page.waitForTimeout(700);
}
await page.mouse.up();
await page.waitForTimeout(800);
const d = await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs.events.off('postupdate', window.__dh);
  if (gs.coverRegistry) gs.coverRegistry.spots = window.__spots;
  return window.__d;
});
console.log(`\ndash east x3 (${d.n} frames, ${d.dashF} mid-dash, peak |vx| ${Math.round(d.sp)}px/s)`);
console.log(`  worst world-ahead DURING the dashes: ${d.minAhead === 1e9 ? 'n/a' : Math.round(d.minAhead)}px   peak lead ${Math.round(d.lead)}   peak lagX ${Math.round(d.lag)}`);
console.log(`  casts: ${casts.map((c) => (c.took ? `ok(${c.timer}ms)` : `REFUSED ${JSON.stringify(c.before)}`)).join('  ')}`);
if (d.dashF < 3) console.log('  ⚠ few or no frames landed inside a dash — read the casts line above before believing this row');

await place(500, 700); await run('diagonal NE', [[0.75, -0.75, 2600]]);
await place(500, 700); await run('diagonal SE', [[0.75, 0.75, 2600]]);
await place(1100, 700); await run('diagonal NW', [[-0.75, -0.75, 2600]]);
await place(560, 1370); await run('east along south wall', [[1, 0, 1900]]);


// ── REVERSAL SETTLING ──────────────────────────────────────────────────────
// The number that says whether the lead is anticipation or drift: from the
// frame the stick flips, how long until the lead has crossed neutral and
// reached the far side.
for (const [label, a, b] of [['east -> west', 1, -1], ['west -> east', -1, 1]]) {
  await place(800, 700);
  await page.evaluate(() => { window.__t = []; window.__rec = true; });
  await page.mouse.move(stick.x, stick.y);
  await page.mouse.down();
  await page.mouse.move(stick.x + a * stick.r * 1.4, stick.y, { steps: 2 });
  await page.waitForTimeout(1800);
  const flip = await page.evaluate(() => window.__t.length);
  await page.mouse.move(stick.x + b * stick.r * 1.4, stick.y, { steps: 2 });
  await page.waitForTimeout(2200);
  await page.mouse.up();
  await page.waitForTimeout(500);
  const tr = await page.evaluate(() => { window.__rec = false; return window.__t; });
  const target = b * (cfg.leadX || 1) * 0.8;
  let cross = -1, done = -1;
  for (let i = flip; i < tr.length; i++) {
    if (cross < 0 && Math.sign(tr[i][3]) === b) cross = i - flip;
    if (done < 0 && (b > 0 ? tr[i][3] >= target : tr[i][3] <= target)) { done = i - flip; break; }
  }
  const ms = (n) => (n < 0 ? 'never' : `${Math.round(n * 50)}ms`);
  console.log(`${label.padEnd(24)} lead crosses neutral ${ms(cross)}, reaches 80% of the new side ${ms(done)}   (harness ~50ms/frame)`);
}

await browser.close();
