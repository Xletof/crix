// DIAGNOSIS — the Detention block's cost, and whether its dark state is dark.
//
//   node tests/diag-detention.mjs
//
// Three questions the screenshots cannot answer, in ONE page load:
//
//   COST      room load, EnvLight parts, display list, physics bodies, and
//             whether a `setPower` across the layer is measurable.
//   DARKNESS  the mean and peak luminance of the room's own pixels under
//             LIGHTS OUT, per region, against the three approved arenas. "Is
//             it still dark" is a comparison, not a threshold — this arena's
//             deck is a different value from all three, so the only honest
//             check is the one that puts them side by side.
//   LEAKS     five loads of the same room, and a tour of the other three, so
//             a duplicated light or a growing display list shows up.
//
// BOTH SCENES PAUSED FOR A SHUTTER, `_sectorTint` zeroed and `resetFX` called
// at every one: a paused scene freezes a camera flash forever, and the endless
// sector wash is re-raised after the room banner.
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
await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 909 }));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(1500);

const load = (id) => page.evaluate(async (rid) => {
  const gs = window.game.scene.getScene('Game');
  const { ROOMS } = await import('/src/data/rooms.js');
  const t0 = performance.now();
  gs.loadRoom(ROOMS.find((r) => r.id === rid));
  const ms = performance.now() - t0;
  gs._roomModifier = null;
  gs.events.emit('modifier-active', null, null);
  gs.arenaActive = false;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  await new Promise((r) => setTimeout(r, 1400));
  gs.arenaActive = false;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  const p = gs.player;
  if (p) { p.alive = true; p.setActive(true).setVisible(true).setAlpha(1); p.hp = p.hpMax; }
  gs.lives = 9999;
  gs._sectorTint?.setAlpha(0);
  return {
    ms: +ms.toFixed(1),
    parts: gs.envLight?.parts?.length ?? 0,
    display: gs.children.list.length,
    bodies: gs.walls.getChildren().length,
  };
}, id);

console.log('── COST, five consecutive loads of the same room ───────────────');
for (let i = 0; i < 5; i++) console.log('  detention', JSON.stringify(await load('detention')));

console.log('\n── COST, the other three (leak check: parts must not accumulate) ──');
for (const id of ['hangar', 'corridor', 'vader', 'detention']) {
  console.log(`  ${id.padEnd(10)}`, JSON.stringify(await load(id)));
}

console.log('\n── setPower across the whole layer ────────────────────────────');
console.log(' ', JSON.stringify(await page.evaluate(() => {
  const el = window.game.scene.getScene('Game').envLight;
  const t0 = performance.now();
  for (let i = 0; i < 200; i++) el.setPower((i % 2) ? 1 : 0);
  const per = (performance.now() - t0) / 200;
  el.setPower(0);
  return { perCallMs: +per.toFixed(4), parts: el.parts.length };
})));

console.log('\n── TEXTURE MEMORY added by this pass ──────────────────────────');
console.log(' ', JSON.stringify(await page.evaluate(() => {
  const tm = window.game.textures;
  const kb = (k) => { const s = tm.get(k)?.getSourceImage?.(); return s ? Math.round(s.width * s.height * 4 / 1024) : 0; };
  const keys = ['dt-bench', 'dt-bench-b', 'dt-con-lock'];
  return { newTextures: keys.map((k) => `${k}=${kb(k)}KB`), totalKB: keys.reduce((a, k) => a + kb(k), 0) };
})));

// ── DARKNESS. Sample the room's own pixels with both scenes paused, from a
//    fixed station in each arena, and compare. Not a threshold — a comparison.
const setDark = (on) => page.evaluate((d) => {
  const gs = window.game.scene.getScene('Game');
  const hud = window.game.scene.getScene('HUD');
  if (d) {
    gs._enterDarkArena(); gs._darkChain?.stop?.();
    gs._darkMix.v = 1; gs._applyDarkMix();
    hud.setDarkness(true, 'blackout');
    hud._darkTweens?.blackout?.stop?.(); hud._overlays?.blackout?.setAlpha(1);
  } else {
    gs._darkChain?.stop?.();
    if (gs._darkMix) gs._darkMix.v = 0;
    gs._applyDarkMix(); gs._restoreArenaTints();
    hud.setDarkness(false, 'blackout');
    hud._darkTweens?.blackout?.stop?.(); hud._overlays?.blackout?.setAlpha(0);
  }
}, on);

// The sampled window deliberately excludes the HUD bar (top 84) and the touch
// controls (bottom ~300): a mean over the whole frame is a mean over the
// joysticks, which are the brightest thing on screen in every arena.
async function luma(px, py) {
  await page.evaluate(([x, y]) => {
    const gs = window.game.scene.getScene('Game');
    gs.player.setPosition(x, y); gs.player.setVelocity(0, 0);
    gs.cameras.main.centerOn(x, y);
  }, [px, py]);
  await page.waitForTimeout(260);
  await setDark(true);
  await page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    gs._sectorTint?.setAlpha(0); gs.cameras.main.resetFX?.();
    gs.scene.pause(); window.game.scene.getScene('HUD').scene.pause();
  });
  const buf = await page.screenshot({ clip: { x: 0, y: 90, width: 720, height: 800 } });
  await page.evaluate(() => {
    window.game.scene.getScene('Game').scene.resume();
    window.game.scene.getScene('HUD').scene.resume();
  });
  // Decode in the page: no image library, and the browser already has one.
  const b64 = buf.toString('base64');
  return page.evaluate(async (d) => {
    const img = new Image();
    await new Promise((r) => { img.onload = r; img.src = 'data:image/png;base64,' + d; });
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const cx = c.getContext('2d'); cx.drawImage(img, 0, 0);
    const p = cx.getImageData(0, 0, c.width, c.height).data;
    let sum = 0, peak = 0, lit = 0, n = 0;
    for (let i = 0; i < p.length; i += 4) {
      const l = 0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2];
      sum += l; if (l > peak) peak = l; if (l > 40) lit++; n++;
    }
    return { mean: +(sum / n).toFixed(2), peak: Math.round(peak), pctOver40: +(100 * lit / n).toFixed(2) };
  }, b64);
}

console.log('\n── DARKNESS, matched stations, LIGHTS OUT, both scenes paused ──');
const STATIONS = {
  detention: [['walk-centre', 800, 700], ['objective-nw', 500, 598], ['gate', 1450, 700]],
  corridor:  [['crossing', 700, 700], ['appr-w', 260, 700]],
  hangar:    [['centre', 800, 700]],
  vader:     [['nave', 800, 800]],
};
for (const [id, list] of Object.entries(STATIONS)) {
  await load(id);
  for (const [name, x, y] of list) {
    const r = await luma(x, y);
    console.log(`  ${id.padEnd(10)} ${name.padEnd(13)} mean ${String(r.mean).padStart(6)}  peak ${String(r.peak).padStart(3)}  >40 ${String(r.pctOver40).padStart(5)}%`);
  }
  await setDark(false);
}

await browser.close();
