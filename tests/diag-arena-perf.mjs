// WHAT DOES AN AUTHORED ARENA COST? Print-only, no pass/fail.
//
//   node tests/diag-arena-perf.mjs <roomId> [label]
//
// Reports room-load time, the emissive layer's object count, the display list,
// a LIGHTS OUT power write, and frame-time medians/p95 in both power states.
//
// READ THE OBJECT COUNTS, NOT THE FRAME TIMES. This container's spread across
// two runs of an identical build is wider than anything an environment pass can
// produce — `diag-vader-perf` measured 131.9ms and 140.6ms for the same code.
// The frame figures are here to catch a CATASTROPHE, not a regression.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const ROOM = process.argv[2] || 'hangar';
const LABEL = process.argv[3] || 'run';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
await page.goto('http://localhost:5173/?nodlg=1&nofreeze=1');
await page.waitForTimeout(4000);
await page.mouse.click(360, 640);
await page.waitForTimeout(600);
await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 4242 }));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(1500);

const R = await page.evaluate(async (roomId) => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const gs = window.game.scene.getScene('Game');
  const { ROOMS } = await import('/src/data/rooms.js');
  const { ENDLESS } = await import('/src/config.js');
  const spec = ROOMS.find((r) => r.id === roomId);
  gs.sector = 6 * ENDLESS.bossEvery;

  // Warm the backdrop texture first, then time a COLD-ish load of it: the
  // canvas is cached per room key, so the second load measures the object
  // build rather than the paint. Both numbers matter and only one is reported
  // here — the paint happens once per process.
  gs.loadRoom(spec); await sleep(1500);
  const t0 = performance.now();
  gs.loadRoom(spec);
  const load = +(performance.now() - t0).toFixed(1);
  await sleep(1200);
  gs.arenaActive = false;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  await sleep(300);

  const frames = (n) => new Promise((res) => {
    const out = []; let last = performance.now();
    const h = () => {
      const now = performance.now(); out.push(now - last); last = now;
      if (out.length >= n) { gs.events.off('postupdate', h); res(out); }
    };
    gs.events.on('postupdate', h);
  });
  const stat = (a) => {
    const s = [...a].sort((x, y) => x - y);
    return { med: +s[Math.floor(s.length / 2)].toFixed(1), p95: +s[Math.floor(s.length * 0.95)].toFixed(1) };
  };

  const normal = stat(await frames(140));
  const p0 = performance.now();
  gs._enterDarkArena(); gs._darkChain?.stop?.();
  gs._darkMix.v = 1; gs._applyDarkMix();
  const setPowerMs = +(performance.now() - p0).toFixed(2);
  await sleep(400);
  const dark = stat(await frames(140));
  gs._darkMix.v = 0; gs._applyDarkMix(); gs._restoreArenaTints();

  const bg = window.game.textures.get(`backdrop-${roomId}`).getSourceImage();
  const kitKeys = window.game.textures.getTextureKeys().filter((k) => k.startsWith('ch-con-') || k.startsWith('ch-crate-'));
  return {
    load, setPowerMs,
    envParts: gs.envLight?.parts?.length ?? 0,
    displayList: gs.children.list.length,
    roomLayer: gs.roomLayer.getChildren().length,
    wallBodies: gs.walls.getChildren().filter((w) => w.active).length,
    backdrop: { w: bg.width, h: bg.height, mb: +((bg.width * bg.height * 4) / 1048576).toFixed(2) },
    kitTextures: kitKeys.length,
    kitKb: +(kitKeys.reduce((n, k) => {
      const t = window.game.textures.get(k).getSourceImage();
      return n + t.width * t.height * 4;
    }, 0) / 1024).toFixed(0),
    normalMed: normal.med, normalP95: normal.p95, darkMed: dark.med, darkP95: dark.p95,
  };
}, ROOM);

console.log(`=== ${ROOM} / ${LABEL} ===`);
console.log(JSON.stringify(R, null, 1));
await browser.close();
