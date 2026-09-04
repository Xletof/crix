// DIAG — WHAT THE CAMERA ACTUALLY DOES, before Phase 1 changes anything.
//
//   node tests/diag-camera-baseline.mjs
//
// Camera Phase 1 opens with an audit, and an audit that guesses is worthless.
// This drives the player to each wall of each of the four frozen arenas with
// the real touch stick and reads the numbers off the live camera: scroll,
// clamp, the player's SCREEN position, and how that lands against the top edge
// of the touch controls.
//
// Two things this rig has to get right or it lies:
//   THE CAMERA IS INSET. `setViewport(0, 84, ...)` means a viewport y of 0 is
//   screen y 84. Every screen figure here is stated in SCREEN pixels of the
//   720x1280 logical canvas, which is the space the controls live in.
//   DRIVING MUST USE THE REAL INPUT. Teleporting the player past the camera's
//   smoothing photographs a camera mid-flight and calls it a resting position.
//   Each station holds the stick down until the scroll stops changing.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const URL = 'http://localhost:5173/?nodlg=1&nofreeze=1';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ROOMS = process.argv[2] ? [process.argv[2]] : ['detention', 'corridor', 'hangar', 'vader'];

const browser = await chromium.launch({ executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
page.on('pageerror', (e) => console.error('PAGE ERROR', e));

await page.goto(URL);
await page.waitForTimeout(4500);
await page.mouse.click(360, 640);
await page.waitForTimeout(800);
await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 4242 }));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(1500);

// THE MEASURING BOT MUST NOT DIE. A death restarts the scene and every later
// station reads off a camera that no longer exists — which is how the first run
// of this rig ended. Enemies are also purged at every station: a camera punch
// tween is a live zoom write, and a station that photographs one reports a
// resting zoom of 1.10.
const quiet = async () => page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs.lives = 9999;
  gs.player.hp = gs.player.hpMax = 1e9;
  for (const e of gs.enemies.getChildren().slice()) e.destroy();
  gs.boss = null;
  if (gs._cameraPunchTween) { gs._cameraPunchTween.stop(); gs._cameraPunchTween = null; }
  gs.cameras.main.setZoom(1);
});
await quiet();

// ── Static setup readout ────────────────────────────────────────────────────
const setup = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const cam = gs.cameras.main;
  const { getControls } = await import('/src/systems/controlLayout.js');
  const ctrls = getControls().map((c) => ({ id: c.id, x: c.x, y: c.y, r: c.radius, top: c.y - c.radius }));
  return {
    viewport: { x: cam.x, y: cam.y, w: cam.width, h: cam.height },
    zoom: cam.zoom,
    roundPixels: cam.roundPixels,
    following: !!cam._follow,
    followTarget: cam._follow ? (cam._follow === gs.player ? 'player' : 'other') : null,
    lerp: cam.lerp ? { x: cam.lerp.x, y: cam.lerp.y } : null,
    deadzone: cam.deadzone ? { w: cam.deadzone.width, h: cam.deadzone.height } : null,
    followOffset: { x: cam.followOffset.x, y: cam.followOffset.y },
    useBounds: cam.useBounds,
    bounds: cam._bounds ? { x: cam._bounds.x, y: cam._bounds.y, w: cam._bounds.width, h: cam._bounds.height } : null,
    ctrls,
  };
});
console.log('══ STATIC CAMERA SETUP ══');
console.log(JSON.stringify(setup, null, 2));
const ctrlTop = Math.min(...setup.ctrls.map((c) => c.top));
console.log(`\ntopmost control edge: screen y ${ctrlTop}  (viewport y ${ctrlTop - setup.viewport.y})`);
console.log(`stick tops: ${setup.ctrls.filter((c) => c.id.endsWith('Stick')).map((c) => c.top).join(', ')}`);

// ── Drive to a wall with the real move stick and read the resting frame ─────
async function station(label, dx, dy, ms = 4200) {
  const stick = await page.evaluate(async () => {
    const { getControl } = await import('/src/systems/controlLayout.js');
    const c = getControl('moveStick');
    return { x: c.x, y: c.y, r: c.radius };
  });
  await quiet();
  await page.mouse.move(stick.x, stick.y);
  await page.mouse.down();
  await page.mouse.move(stick.x + dx * stick.r * 1.4, stick.y + dy * stick.r * 1.4, { steps: 3 });
  await page.waitForTimeout(ms);
  const r = await page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    const cam = gs.cameras.main;
    return {
      px: Math.round(gs.player.x), py: Math.round(gs.player.y),
      sx: Math.round(cam.scrollX), sy: Math.round(cam.scrollY),
      zoom: +cam.zoom.toFixed(4),
      maxScrollY: Math.round(cam._bounds.height - cam.height / cam.zoom),
      maxScrollX: Math.round(cam._bounds.width - cam.width / cam.zoom),
      offX: Math.round(cam.followOffset.x), offY: Math.round(cam.followOffset.y),
      viewY: cam.y,
    };
  });
  await page.mouse.up();
  await page.waitForTimeout(600);
  const screenX = Math.round((r.px - r.sx) * r.zoom);
  const screenY = Math.round((r.py - r.sy) * r.zoom) + r.viewY;
  const clampedY = r.sy >= r.maxScrollY - 1 ? 'SOUTH-CLAMPED' : r.sy <= 1 ? 'NORTH-CLAMPED' : '—';
  const clampedX = r.sx >= r.maxScrollX - 1 ? 'EAST-CLAMPED' : r.sx <= 1 ? 'WEST-CLAMPED' : '—';
  const buried = screenY >= ctrlTop;
  console.log(
    `${label.padEnd(12)} player(${String(r.px).padStart(4)},${String(r.py).padStart(4)})`
    + `  scroll(${String(r.sx).padStart(4)},${String(r.sy).padStart(4)})/max(${r.maxScrollX},${r.maxScrollY})`
    + `  screen(${String(screenX).padStart(4)},${String(screenY).padStart(4)})`
    + `  off(${r.offX},${r.offY}) zoom ${r.zoom}`
    + `  ${clampedX} ${clampedY}${buried ? '   ⚠ PLAYER UNDER CONTROLS' : ''}`,
  );
  return { screenY, buried };
}

for (const id of ROOMS) {
  await page.evaluate(async (rid) => {
    const gs = window.game.scene.getScene('Game');
    const { ROOMS } = await import('/src/data/rooms.js');
    gs.loadRoom(ROOMS.find((r) => r.id === rid));
  }, id);
  await page.waitForTimeout(1600);
  await quiet();
  const b = await page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    const c = gs.cameras.main;
    return { w: c._bounds.width, h: c._bounds.height, rw: gs.roomSpec.bounds.w, rh: gs.roomSpec.bounds.h };
  });
  console.log(`\n══ ${id.toUpperCase()}  room ${b.rw}x${b.rh}  camBounds ${b.w}x${b.h}`
    + `  ${b.w === b.rw && b.h === b.rh ? '(camera bounds == room bounds)' : '(DIFFER)'} ══`);
  await station('south', 0, 1);
  await station('north', 0, -1);
  await station('west', -1, 0);
  await station('east', 1, 0);
  await station('SE corner', 0.8, 0.8, 5200);
  await station('SW corner', -0.8, 0.8, 5200);
}

await browser.close();
