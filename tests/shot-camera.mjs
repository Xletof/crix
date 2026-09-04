// SHOT — WHAT THE OVERSCAN ACTUALLY SHOWS.
//
//   node tests/shot-camera.mjs
//
// "Look at it" is the post-mortem's own rule and it is the only way to answer
// the one open question this pass cannot assert: extending the camera past the
// room's edge buys the south safe area, and what it COSTS is whatever is out
// there. Nothing is painted beyond the backdrop, so the answer is the scene's
// own background (#0a0c14) immediately outside a perimeter wall band 80-116px
// thick — the room ending, which it does. This photographs it in all four
// arenas at the station where the cost is largest: the south wall.
//
// THREE THINGS THAT RUIN A CAMERA SCREENSHOT HERE, all of them already paid
// for elsewhere in this suite: a paused scene freezes a `player-hurt` camera
// flash forever (`resetFX` first), `loadRoom` schedules its objective banner on
// a delay so it can arrive minutes into a run, and `_sectorTint` is re-raised
// after the room banner. The camera itself is left ALONE — the whole subject is
// where the director puts it, so a hand-placed camera would photograph the rig.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

// TWO PAGE LOADS, AND THE REASON IS A TRAP WORTH KEEPING. A dynamic
// `import('/src/config.js')` from inside `page.evaluate` does NOT hand back the
// module instance the running game is holding — writing `CAMERA.debug = true`
// there mutates a second copy, and the overlay never appears with no error
// anywhere. Anything that MUTATES config from a rig has to go through the
// game's own entry point; `?camdbg=1` is BootScene's, and it works. Reading is
// still safe: both copies carry the same authored values.
const URL = 'http://localhost:5173/?nodlg=1&nofreeze=1';
const URL_DBG = `${URL}&camdbg=1`;
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const OUT = 'tests/out/camera-phase1';

const browser = await chromium.launch({ executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
page.on('pageerror', (e) => console.error('PAGE ERROR', e));

await page.goto(URL);
await page.waitForTimeout(4500);
await page.mouse.click(360, 640);
await page.waitForTimeout(800);
await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 5150 }));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(1500);

async function shot(id, fx, fy, name) {
  await page.evaluate(async ([rid, ffx, ffy]) => {
    const gs = window.game.scene.getScene('Game');
    const { ROOMS } = await import('/src/data/rooms.js');
    gs.scene.resume();
    gs.loadRoom(ROOMS.find((r) => r.id === rid));
    gs.lives = 9999; gs.player.hp = gs.player.hpMax = 1e9;
    for (const e of gs.enemies.getChildren().slice()) e.destroy();
    const { w, h } = gs.roomSpec.bounds;
    const px = 22 + ffx * (w - 44), py = 22 + ffy * (h - 44);
    gs.player.setPosition(px, py); gs.player.setVelocity(0, 0);
    gs.cameraDirector.reset(px, py);
  }, [id, fx, fy]);
  await page.waitForTimeout(1400);
  await page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    gs._sectorTint?.setAlpha(0);
    gs.cameras.main.resetFX?.();
    window.game.scene.getScene('HUD')?.banner?.setAlpha(0);
    gs.cameraDirector.update(16);
    gs.scene.pause();
    window.game.scene.getScene('HUD')?.scene.pause();
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(name);
}

for (const id of ['vader', 'hangar', 'corridor', 'detention']) {
  await shot(id, 0.5, 1, `${id}-south`);
  await shot(id, 0.02, 0.02, `${id}-nw`);
}
// The tuning overlay, on a page that asked for it at boot.
await page.goto(URL_DBG);
await page.waitForTimeout(4500);
await page.mouse.click(360, 640);
await page.waitForTimeout(800);
await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 5150 }));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(1500);
await shot('detention', 0.5, 0.5, 'detention-centre-debug');
await shot('detention', 0.5, 1, 'detention-south-debug');

await browser.close();
