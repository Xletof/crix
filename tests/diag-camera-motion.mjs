// DIAG — DOES THE CAMERA HAVE MASS, AND DOES IT EVER RING?
//
//   node tests/diag-camera-motion.mjs
//
// Feel is a human verdict, but three of its failure modes are measurable and
// all three have to be ruled out before a build is worth a handset: OSCILLATION
// (the scroll reverses direction while the player does not), LAG (how far the
// camera is behind its own target at speed) and JITTER (a scroll that moves
// when the player has effectively stopped).
//
// SAMPLED FROM INSIDE THE PAGE, on `postupdate`, for the reason `tests/README`
// gives: `page.evaluate` polling costs 200-400ms a round trip and would miss
// most of a reversal. The hook records one row per frame and the rig reads the
// whole trace out once at the end.
//
// The camera is driven with the REAL move stick. A teleported player is a
// step input, and a step input tells you nothing about how a camera tracks a
// human being.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const URL = 'http://localhost:5173/?nodlg=1&nofreeze=1';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const browser = await chromium.launch({ executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
page.on('pageerror', (e) => console.error('PAGE ERROR', e));

await page.goto(URL);
await page.waitForTimeout(4500);
await page.mouse.click(360, 640);
await page.waitForTimeout(800);
await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 77 }));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(1500);

await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { ROOMS } = await import('/src/data/rooms.js');
  gs.loadRoom(ROOMS.find((r) => r.id === 'detention'));
});
await page.waitForTimeout(1400);

const quiet = () => page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs.lives = 9999; gs.player.hp = gs.player.hpMax = 1e9;
  for (const e of gs.enemies.getChildren().slice()) e.destroy();
  if (gs._cameraPunchTween) { gs._cameraPunchTween.stop(); gs._cameraPunchTween = null; }
  gs.cameras.main.setZoom(1);
});

await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  window.__trace = [];
  window.__rec = false;
  gs.events.on('postupdate', () => {
    if (!window.__rec) return;
    const c = gs.cameras.main, d = gs.cameraDirector;
    window.__trace.push([
      Math.round(gs.player.x), Math.round(gs.player.y),
      +c.scrollX.toFixed(2), +c.scrollY.toFixed(2),
      +d._tx.toFixed(2), +d._ty.toFixed(2),
      Math.round(gs.player.body.velocity.x), Math.round(gs.player.body.velocity.y),
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
    gs.cameraDirector.reset(px, py);
  }, [x, y]);
  await page.waitForTimeout(400);
}

// `legs` = [[dx, dy, ms], ...] held on one continuous press, so a reversal is a
// reversal and not a release plus a new grab.
async function run(label, legs) {
  await page.evaluate(() => { window.__trace = []; window.__rec = true; });
  await page.mouse.move(stick.x, stick.y);
  await page.mouse.down();
  for (const [dx, dy, ms] of legs) {
    await page.mouse.move(stick.x + dx * stick.r * 1.4, stick.y + dy * stick.r * 1.4, { steps: 2 });
    await page.waitForTimeout(ms);
  }
  await page.mouse.up();
  await page.waitForTimeout(900);
  const tr = await page.evaluate(() => { window.__rec = false; return window.__trace; });
  report(label, tr);
}

function report(label, tr) {
  if (tr.length < 8) { console.log(`${label}: only ${tr.length} frames — NOT MEASURED`); return; }
  let maxLagX = 0, maxLagY = 0, revX = 0, revY = 0, still = 0, stillDrift = 0;
  let prevDX = 0, prevDY = 0;
  for (let i = 1; i < tr.length; i++) {
    const [px, py, sx, sy, tx, ty, vx, vy] = tr[i];
    maxLagX = Math.max(maxLagX, Math.abs(sx - tx));
    maxLagY = Math.max(maxLagY, Math.abs(sy - ty));
    const dx = sx - tr[i - 1][2], dy = sy - tr[i - 1][3];
    // An OSCILLATION is a scroll reversal of real size while the player's own
    // velocity on that axis has not reversed. A 0.5px threshold keeps rounding
    // and the settle tail out of the count.
    // Steady = the player's own velocity on that axis kept one sign for the
    // last three frames. Without that window a genuine player turn — where the
    // camera's momentum carries it a moment longer, which is the mass this pass
    // is FOR — is counted as ringing, and the first version of this rig did.
    const steady = (k) => i > 3 && [1, 2, 3].every((b) => Math.sign(tr[i - b][k]) === Math.sign(tr[i][k]));
    if (Math.abs(dx) > 0.5 && Math.abs(prevDX) > 0.5 && Math.sign(dx) !== Math.sign(prevDX) && steady(6)) revX++;
    if (Math.abs(dy) > 0.5 && Math.abs(prevDY) > 0.5 && Math.sign(dy) !== Math.sign(prevDY) && steady(7)) revY++;
    if (Math.abs(dx) > 0.5) prevDX = dx;
    if (Math.abs(dy) > 0.5) prevDY = dy;
    if (Math.abs(vx) < 2 && Math.abs(vy) < 2) { still++; stillDrift += Math.abs(dx) + Math.abs(dy); }
  }
  // Settle: frames after the last input until scroll stops changing.
  let settle = 0;
  for (let i = tr.length - 1; i > 1; i--) {
    if (Math.abs(tr[i][2] - tr[i - 1][2]) > 0.5 || Math.abs(tr[i][3] - tr[i - 1][3]) > 0.5) { settle = tr.length - i; break; }
  }
  console.log(
    `${label.padEnd(26)} frames ${String(tr.length).padStart(3)}`
    + `  maxLag(${String(Math.round(maxLagX)).padStart(3)},${String(Math.round(maxLagY)).padStart(3)})`
    + `  osc(${revX},${revY})`
    + `  settleFrames ${String(settle).padStart(2)}`
    + `  stillDrift ${stillDrift.toFixed(1)}px over ${still}f`,
  );
}

console.log('══ CAMERA MOTION — detention block, real stick, sampled on postupdate ══');
console.log('maxLag = |scroll - target|.  osc = scroll direction flips while the player has not turned.');
console.log('stillDrift = total scroll movement across frames where the player is standing still.\n');

await place(800, 700);  await run('slow horizontal',       [[0.35, 0, 2600]]);
await place(800, 700);  await run('slow vertical',         [[0, 0.35, 2600]]);
await place(800, 700);  await run('diagonal',              [[0.7, 0.7, 2600]]);
// DASH is the fastest thing the player can do (950px/s) and the worst case for
// the lag ceiling, so it gets its own pass — with its own self-contained probe
// rather than the shared trace. Two reasons, both paid for: a synthetic click
// on the dash widget while the move stick is already held is not a second
// pointer but an invalid mouse sequence, so the dash is fired through
// `tryDash()`, the real entry point the button and the SHIFT key both call; and
// the shared recorder stopped after six frames here for reasons the trace
// itself could not show, which is exactly the case for a probe that accumulates
// its own maximum inside the page and cannot be interrupted by a stale
// listener.
// Staged mid-room and running EAST, deliberately. Dashing south from (800,400)
// spends its whole distance inside the north clamp and the deadzone, and the
// probe then reports a peak lag of 0.0px — a true number about a station that
// asks the camera nothing.
await place(400, 700);
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  window.__d = { n: 0, lag: 0, sp: 0, minY: 1e9, maxY: -1e9, dashF: 0 };
  window.__dh = () => {
    const c = gs.cameras.main, d = gs.cameraDirector, p = gs.player;
    window.__d.n++;
    if (p.isDashing) window.__d.dashF++;
    window.__d.lag = Math.max(window.__d.lag, Math.hypot(c.scrollX - d._tx, c.scrollY - d._ty));
    window.__d.sp = Math.max(window.__d.sp, Math.hypot(p.body.velocity.x, p.body.velocity.y));
    const sy = (p.y - c.scrollY) * c.zoom + c.y;
    window.__d.minY = Math.min(window.__d.minY, sy);
    window.__d.maxY = Math.max(window.__d.maxY, sy);
  };
  gs.events.on('postupdate', window.__dh);
});
await page.mouse.move(stick.x, stick.y);
await page.mouse.down();
await page.mouse.move(stick.x + stick.r * 1.4, stick.y, { steps: 2 });
await page.waitForTimeout(250);
for (let i = 0; i < 3; i++) {
  await page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    gs.player.dashCharges = 2;
    gs.player.tryDash();
  });
  await page.waitForTimeout(700);
}
await page.mouse.up();
await page.waitForTimeout(900);
const d = await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs.events.off('postupdate', window.__dh);
  return window.__d;
});
console.log(`\ndash east x3 (${d.n} frames, ${d.dashF} of them mid-dash, peak player speed ${Math.round(d.sp)}px/s)`);
console.log(`  peak |scroll - target|: ${d.lag.toFixed(1)}px   (CAMERA.maxLag ceiling is 190)`);
console.log(`  player SCREEN y range during the dashes: ${Math.round(d.minY)} .. ${Math.round(d.maxY)}`
  + `   topmost control edge 926`);
if (d.dashF < 3) console.log('  ⚠ the dash barely fired — this pass measured a walk\n'); else console.log('');

await place(800, 700);  await run('rapid L-R reversal',    [[-1, 0, 500], [1, 0, 500], [-1, 0, 500], [1, 0, 500], [-1, 0, 500]]);
await place(800, 700);  await run('rapid N-S reversal',    [[0, -1, 500], [0, 1, 500], [0, -1, 500], [0, 1, 500], [0, 1, 500]]);
await place(800, 700);  await run('idle (deadzone hold)',  [[0.06, 0.06, 1800]]);
await place(800, 1000); await run('approach south wall',   [[0, 1, 2600]]);
await place(200, 1370); await run('travel along south',    [[1, 0, 3200]]);
await place(1560, 1370); await run('SE corner -> centre',  [[-0.9, -0.9, 3000]]);

// ROOM TRANSITION — the camera must arrive composed, not fly in from the last
// room's scroll, and it must never emit a NaN doing it.
const rooms = ['hangar', 'corridor', 'detention', 'vader', 'hangar'];
let bad = 0, worst = 0;
for (const id of rooms) {
  await page.evaluate(async (rid) => {
    const gs = window.game.scene.getScene('Game');
    const { ROOMS } = await import('/src/data/rooms.js');
    window.__first = null;
    gs.loadRoom(ROOMS.find((r) => r.id === rid));
    const c = gs.cameras.main;
    window.__first = { sx: c.scrollX, sy: c.scrollY, px: gs.player.x, py: gs.player.y, vy: gs.cameraDirector._vy };
  }, id);
  const r = await page.evaluate(() => window.__first);
  const screenY = Math.round(r.py - r.sy) + 84;
  const okNum = [r.sx, r.sy].every(Number.isFinite);
  if (!okNum) bad++;
  worst = Math.max(worst, Math.abs(r.vy));
  console.log(`transition -> ${id.padEnd(10)} scroll(${Math.round(r.sx)},${Math.round(r.sy)})`
    + ` player screen y ${screenY}  springV ${r.vy.toFixed(2)}  ${okNum ? '' : 'NaN!'}`);
  await page.waitForTimeout(900);
}
console.log(`\nNaN scrolls: ${bad}   worst residual spring velocity on arrival: ${worst.toFixed(2)}`);

await browser.close();
