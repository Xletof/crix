// Touch-control layout editor (Pause > CONTROLS).
//
// The whole risk with a layout editor is that it moves PICTURES and not INPUT.
// So this drives it with real pointer gestures and then, with the editor shut
// and the game running again, taps the dash button at its NEW position and at
// its OLD one — a dash on the first and no dash on the second is the only proof
// that the hit region moved with the sprite.
//
// It also checks the layout survives a reload (localStorage) and that RESET
// puts everything back.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const OUT = new URL('./out/', import.meta.url).pathname;

// Pause card: cardY = 1280*0.06, baseY = cardY + 410, 92px pitch.
const CONTROLS_ROW = Math.round(1280 * 0.06 + 410 + 92 * 5);
// ControlsScene card: cardY = 56 → slider at +208, buttons at +288.
const SLIDER_Y = 56 + 208;
const RESET_BTN = [360 - 158, 56 + 288];
const DONE_BTN = [360 + 158, 56 + 288];
// Where the dash button starts, and where this test drags it to.
const DASH_HOME = [416, 1102];
const DASH_MOVED = [620, 700];

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

const startGame = async () => {
  await page.waitForTimeout(4000);
  await page.mouse.click(360, 640);
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    const t = window.game?.scene?.getScene('Title');
    if (t?.sys?.isActive()) t.scene.start('Game');
  });
  await page.waitForFunction(() => {
    const gs = window.game?.scene?.getScene('Game');
    return !!(gs?.player && gs?.enemies);
  }, null, { timeout: 20000 });
  await page.waitForTimeout(1500);
};

// Phaser only sees a drag if it gets intermediate pointermove events, so step
// the mouse rather than jumping — a single move reads as a teleport and the
// editor's drag handler never runs.
const drag = async (from, to, steps = 12) => {
  await page.mouse.move(from[0], from[1]);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(
      from[0] + ((to[0] - from[0]) * i) / steps,
      from[1] + ((to[1] - from[1]) * i) / steps,
    );
    await page.waitForTimeout(30);
  }
  await page.mouse.up();
  await page.waitForTimeout(200);
};

const openEditor = async () => {
  await page.mouse.click(676, 120);          // HUD pause button
  await page.waitForTimeout(900);
  await page.mouse.click(360, CONTROLS_ROW); // CONTROLS row
  await page.waitForTimeout(900);
};

// What the LIVE HUD widgets are, not what the store says.
const readHud = () => page.evaluate(() => {
  const h = window.game.scene.getScene('HUD');
  const pip = h.ammoPips[0];
  return {
    dash: { x: h.dashButton.x, y: h.dashButton.y, r: h.dashButton.radius, s: h.dashButton.scale },
    move: { x: h.moveStick.homeX, y: h.moveStick.homeY, r: h.moveStick.radius },
    fire: { x: h.fireStick.homeX, y: h.fireStick.homeY, r: h.fireStick.radius },
    superB: { x: h.superButton.x, y: h.superButton.y, r: h.superButton.radius },
    melee: { x: h.meleeButton.x, y: h.meleeButton.y, r: h.meleeButton.radius },
    pipX: pip.x, pipY: pip.y, secX: h._secX, secY: h._secY,
    // The base sprite must sit at the home position, or the stick was resized
    // without being re-anchored.
    baseX: h.moveStick.base.x, baseY: h.moveStick.base.y,
    baseScale: h.moveStick.base.scaleX,
  };
});

await page.goto('http://localhost:5173/');
await startGame();

const before = await readHud();

await openEditor();
const opened = await page.evaluate(() => {
  const h = window.game.scene.getScene('HUD');
  return {
    editorOpen: !!window.game.scene.getScene('Controls')?.sys?.isActive(),
    gamePaused: !window.game.scene.getScene('Game').sys.isActive(),
    hudPaused: !window.game.scene.getScene('HUD').sys.isActive(),
    // The real widgets must be blanked while the proxies are up, or the player
    // is looking at two dash buttons and can only drag one of them.
    realDashShown: h.dashButton.image.visible,
    realStickShown: h.moveStick.base.visible,
  };
});
await page.screenshot({ path: `${OUT}/controls-1-editor.png` });

// Drag the dash button somewhere new, then select the move stick and grow it.
await drag(DASH_HOME, DASH_MOVED);
const afterDrag = await page.evaluate(() => {
  const c = window.game.scene.getScene('Controls');
  return { selected: c.selected, proxyX: c.proxies.dashBtn.img.x, proxyY: c.proxies.dashBtn.img.y };
});

await page.mouse.click(126, 1154);           // select the move stick
await page.waitForTimeout(250);
await page.mouse.move(570, SLIDER_Y);        // slider hard right = SCALE_MAX
await page.mouse.down();
await page.mouse.move(575, SLIDER_Y);
await page.waitForTimeout(120);
await page.mouse.up();
await page.waitForTimeout(250);
await page.screenshot({ path: `${OUT}/controls-2-edited.png` });

const edited = await page.evaluate(() => {
  const c = window.game.scene.getScene('Controls');
  return {
    selected: c.selected,
    stored: JSON.parse(localStorage.getItem('crix.controls') || 'null'),
    proxyScale: c.proxies.moveStick.img.scaleX,
  };
});

// Close: this is where the live HUD is supposed to pick the layout up.
await page.mouse.click(DONE_BTN[0], DONE_BTN[1]);
await page.waitForTimeout(800);
const closed = await page.evaluate(() => {
  const h = window.game.scene.getScene('HUD');
  return {
    editorOpen: !!window.game.scene.getScene('Controls')?.sys?.isActive(),
    gameRunning: window.game.scene.getScene('Game').sys.isActive(),
    hudRunning: window.game.scene.getScene('HUD').sys.isActive(),
    realDashShown: h.dashButton.image.visible,
    realStickShown: h.moveStick.base.visible,
  };
});
const applied = await readHud();
await page.screenshot({ path: `${OUT}/controls-3-applied.png` });

// ── The real test: does INPUT follow the button? ────────────────────────────
const dashAt = async (x, y) => page.evaluate(async ([px, py]) => {
  const gs = window.game.scene.getScene('Game');
  const p = gs.player;
  p.dashCharges = 2;
  p.isDashing = false;
  p.dashRechargeTimer = 0;
  const before = p.dashCharges;
  const hud = window.game.scene.getScene('HUD');
  // Synthesise the tap through the HUD's own handlers with a pointer object
  // shaped like Phaser's — clicking through the page would also hand the
  // pointer to the aim stick and start a live firefight mid-measurement.
  const pointer = { id: 99, x: px, y: py };
  hud.dashButton.handleDown(pointer);
  hud.dashButton.handleUp(pointer);
  await new Promise((r) => setTimeout(r, 120));
  return { before, after: p.dashCharges, dashed: p.dashCharges < before };
}, [x, y]);

const dashNew = await dashAt(DASH_MOVED[0], DASH_MOVED[1]);
const dashOld = await dashAt(DASH_HOME[0], DASH_HOME[1]);

// ── Persistence across a reload ─────────────────────────────────────────────
await page.reload();
await startGame();
const reloaded = await readHud();
await page.screenshot({ path: `${OUT}/controls-4-reloaded.png` });

// ── RESET puts it back ──────────────────────────────────────────────────────
await openEditor();
await page.mouse.click(RESET_BTN[0], RESET_BTN[1]);
await page.waitForTimeout(300);
await page.mouse.click(DONE_BTN[0], DONE_BTN[1]);
await page.waitForTimeout(800);
const reset = await readHud();
await page.screenshot({ path: `${OUT}/controls-5-reset.png` });

const near = (a, b, tol = 2) => Math.abs(a - b) <= tol;

console.log(JSON.stringify({
  before, opened, afterDrag, edited, closed, applied, dashNew, dashOld, reloaded, reset,
}, null, 2));
console.log('page errors:', errors.length ? errors : 'none');

const fails = [];
if (!opened.editorOpen) fails.push('editor did not open from the pause menu');
if (!opened.gamePaused || !opened.hudPaused) fails.push('game/HUD not paused under the editor');
if (opened.realDashShown || opened.realStickShown) fails.push('the real touch controls were still drawn under the editor proxies');
if (afterDrag.selected !== 'dashBtn') fails.push(`drag did not select the dash button (${afterDrag.selected})`);
if (!near(afterDrag.proxyX, DASH_MOVED[0], 6) || !near(afterDrag.proxyY, DASH_MOVED[1], 6)) {
  fails.push(`dash proxy did not follow the drag: ${afterDrag.proxyX},${afterDrag.proxyY}`);
}
if (edited.selected !== 'moveStick') fails.push(`tapping the move stick did not select it (${edited.selected})`);
if (!edited.stored) fails.push('nothing written to localStorage');
if (edited.stored && !near(edited.stored.moveStick.scale, 1.45, 0.01)) {
  fails.push(`slider did not drive scale to max: ${edited.stored?.moveStick?.scale}`);
}
if (closed.editorOpen) fails.push('editor did not close');
if (!closed.gameRunning || !closed.hudRunning) fails.push('game/HUD did not resume after closing');
if (!closed.realDashShown || !closed.realStickShown) fails.push('the real touch controls stayed hidden after the editor closed');

// Applied to the live HUD.
if (!near(applied.dash.x, DASH_MOVED[0], 6) || !near(applied.dash.y, DASH_MOVED[1], 6)) {
  fails.push(`HUD dash button did not move: ${applied.dash.x},${applied.dash.y}`);
}
if (!near(applied.move.r, 90 * 1.45, 1)) fails.push(`move stick radius did not scale: ${applied.move.r}`);
if (!near(applied.baseScale, (90 * 1.45) / 110, 0.02)) fails.push(`move stick sprite did not scale: ${applied.baseScale}`);
if (!near(applied.baseX, applied.move.x) || !near(applied.baseY, applied.move.y)) {
  fails.push('move stick base is not sitting at its home position after a resize');
}
if (!near(applied.secY, applied.move.y - applied.move.r - 60, 2)) {
  fails.push(`secondary readout did not ride with the move stick: ${applied.secY}`);
}
// Untouched controls must not drift.
if (!near(applied.superB.x, before.superB.x) || !near(applied.melee.y, before.melee.y)) {
  fails.push('an untouched control moved');
}

// Input, not pixels.
if (!dashNew.dashed) fails.push('tapping the dash button at its NEW position did not dash — hit region left behind');
if (dashOld.dashed) fails.push('tapping the OLD dash position still dashed — stale hit region');

// Persistence.
if (!near(reloaded.dash.x, DASH_MOVED[0], 6) || !near(reloaded.move.r, 90 * 1.45, 1)) {
  fails.push(`layout did not survive a reload: dash=${reloaded.dash.x},${reloaded.dash.y} moveR=${reloaded.move.r}`);
}

// Reset.
if (!near(reset.dash.x, before.dash.x) || !near(reset.dash.y, before.dash.y)) {
  fails.push(`RESET did not restore the dash button: ${reset.dash.x},${reset.dash.y}`);
}
if (!near(reset.move.r, before.move.r) || !near(reset.pipX, before.pipX) || !near(reset.secY, before.secY)) {
  fails.push('RESET did not restore the sticks and their readouts');
}
if (errors.length) fails.push(`page errors: ${errors.join(' | ')}`);

console.log(fails.length
  ? `\nFAIL:\n - ${fails.join('\n - ')}`
  : '\nPASS: the editor moves the real controls, persists, and resets');
await browser.close();
process.exit(fails.length ? 1 : 0);
