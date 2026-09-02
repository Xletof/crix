// DIAG — WHERE THE REACTOR'S LIGHT ACTUALLY LANDS, in pixels.
//
//   node tests/diag-junction-reactor-light.mjs
//
// TWO CLAIMS, ONE INSTRUMENT. §19 asks for a locality profile — a large gain at
// the emitter, a smaller one nearby, near zero on unrelated room pixels — and
// §20 asks for proof that normal power did not move. Both are the same
// measurement at two power states: photograph the room, switch the reactor's
// own light off, photograph it again, and subtract.
//
// THREE WAYS THIS KIND OF DIFF LIES, all of them already paid for here:
//   TWO PAGE LOADS ARE NOT COMPARABLE. `paintBackdrop` consumes `Math.random`
//   for its panel and scorch scatter and nothing seeds it in a live run, so the
//   same build renders a different floor every load. The mutation happens
//   INSIDE one page.
//   TIME PASSES BETWEEN SHUTTERS. The player's idle animation, the objective's
//   SLICE prompt and the HUD's own tweens all advance. BOTH scenes are paused —
//   the HUD is a separate scene with its own tweens.
//   A PAUSED SCENE STILL PAINTS, BUT NOT ON YOUR TIMETABLE. A fixed wait after
//   a hand-scrolled camera photographs the previous frame. `stable()` shoots
//   until two consecutive frames are byte-identical.
// And the rule that catches all three: a probe that reports zero must be shown
// capable of reporting something else. The emergency pass is that control.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const URL = 'http://localhost:5173/?nodlg=1&nofreeze=1';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

// `prop-core` is 304x344 at (260, 400) with origin (0.5, 1) — world x 108..412,
// y 56..400. Its lit slot is world x 236..288, y 168..272. With the camera
// scrolled to (0, 0) and the HUD's 84px top bar, screen = world + (0, 84).
const TOP = 84;
const R = (name, x0, y0, x1, y1) => ({ name, x0, y0: y0 + TOP, x1, y1: y1 + TOP });
const REGIONS = [
  R('emitter   slot',        236, 168,  288,  272),
  R('recess    cavity rim',  222, 152,  302,  288),
  R('housing   shell',       120,  70,   400,  390),
  R('near deck under it',    140, 404,   390,  520),
  R('far room  the crossing',420, 420,   700,  700),
];

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

await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { ROOMS } = await import('/src/data/rooms.js');
  const { ENDLESS } = await import('/src/config.js');
  gs.sector = 6 * ENDLESS.bossEvery;
  gs.loadRoom(ROOMS.find((r) => r.id === 'corridor'));
  gs._roomModifier = null;
  gs.events.emit('modifier-active', null, null);
  await new Promise((r) => setTimeout(r, 2200));
  gs.lives = 9999; gs._sectorTint?.setAlpha(0);
});
await page.waitForTimeout(4200);

// Park the player where the camera would clamp anyway, kill the wave, and stop
// BOTH scenes. From here nothing in the page changes unless this script does it.
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs.arenaActive = false;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  gs.player.setPosition(320, 700).setVelocity?.(0, 0);
  gs._sectorTint?.setAlpha(0);
  gs.cameras.main.resetFX?.();
  gs.cameras.main.stopFollow();
  gs.cameras.main.setScroll(0, 0);
  gs.scene.pause();
  window.game.scene.getScene('HUD').scene.pause();
});
await page.waitForTimeout(500);

const raw = async () => (await page.screenshot()).toString('base64');
const stable = async () => {
  let prev = await raw();
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(120);
    const now = await raw();
    if (now === prev) return Buffer.from(now, 'base64');
    prev = now;
  }
  return Buffer.from(prev, 'base64');
};

// Decoding a PNG without an image library: hand it back to a canvas in the page.
const pixels = async (buf) => page.evaluate((b64) => new Promise((res) => {
  const im = new Image();
  im.onload = () => {
    const c = document.createElement('canvas');
    c.width = im.width; c.height = im.height;
    const x = c.getContext('2d');
    x.drawImage(im, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    res({ w: c.width, h: c.height, d: Array.from(d) });
  };
  im.src = 'data:image/png;base64,' + b64;
}), buf.toString('base64'));

const power = (v) => page.evaluate((p) => {
  const gs = window.game.scene.getScene('Game');
  gs.envLight.setPower(p);
}, v);
const dropReactor = () => page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  const hit = gs.envLight.parts.filter((p) => p._tag === 'reactor' || p.texture?.key === 'prop-core-glow');
  hit.forEach((p) => p.setVisible(false));
  return hit.length;
});
const raiseReactor = () => page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs.envLight._v = null;                 // force the next setPower to re-run
});

const profile = async (label, p) => {
  await power(p);
  const withIt = await pixels(await stable());
  const n = await dropReactor();
  const without = await pixels(await stable());
  await raiseReactor(); await power(p);
  await stable();

  console.log(`\n── ${label} (power ${p}, ${n} reactor parts) ──`);
  // THE CONTAINMENT CLAIM, MEASURED. `prop-core` occupies world x 108..412,
  // y 56..400, which with the camera at (0, 0) is screen x 108..412,
  // y 140..484. At normal power nothing outside that rectangle may move at all;
  // under emergency the only thing entitled to is the deck spill.
  const PROP = { x0: 108, y0: 56 + TOP, x1: 412, y1: 400 + TOP };
  let changed = 0, maxAll = 0, outside = 0, maxOut = 0;
  const rows = REGIONS.map((r) => ({ name: r.name, sum: 0, n: 0, max: 0 }));
  for (let y = 0; y < withIt.h; y++) {
    for (let x = 0; x < withIt.w; x++) {
      const i = (y * withIt.w + x) * 4;
      const dr = withIt.d[i] - without.d[i];
      const dg = withIt.d[i + 1] - without.d[i + 1];
      const db = withIt.d[i + 2] - without.d[i + 2];
      const m = Math.max(Math.abs(dr), Math.abs(dg), Math.abs(db));
      if (m > 0) changed++;
      if (m > maxAll) maxAll = m;
      if (m > 0 && (x < PROP.x0 || x >= PROP.x1 || y < PROP.y0 || y >= PROP.y1)) {
        outside++; if (m > maxOut) maxOut = m;
      }
      for (let k = 0; k < REGIONS.length; k++) {
        const r = REGIONS[k];
        if (x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1) {
          rows[k].sum += m; rows[k].n++; if (m > rows[k].max) rows[k].max = m;
        }
      }
    }
  }
  console.log(`   whole frame: ${changed} px changed, max channel delta ${maxAll}`);
  console.log(`   outside the prop's own rectangle: ${outside} px changed, peak ${maxOut}`);
  for (const r of rows) {
    console.log(`   ${r.name.padEnd(26)} mean ${(r.sum / Math.max(1, r.n)).toFixed(2).padStart(6)}   peak ${String(r.max).padStart(3)}`);
  }
  return { changed, maxAll, outside, maxOut, rows };
};

// NORMAL POWER FIRST, because it is the frozen one.
const norm = await profile('NORMAL POWER — the approved state', 0);
// EMERGENCY IS THE CONTROL as well as the subject: if it also came back at
// zero the instrument would be measuring nothing at either end.
const emer = await profile('EMERGENCY POWER — the pass', 1);

console.log('\n── verdicts ──');
const far = (r) => r.rows.find((x) => x.name.startsWith('far room')).max;
const deck = (r) => r.rows.find((x) => x.name.startsWith('near deck')).max;
console.log(`   normal-power frame delta ......... ${norm.changed} px, peak ${norm.maxAll}`);
console.log(`   normal delta on unrelated room ... peak ${far(norm)}`);
console.log(`   normal delta OUTSIDE the prop .... ${norm.outside} px, peak ${norm.maxOut}`);
console.log(`   emergency frame delta ........... ${emer.changed} px, peak ${emer.maxAll}`);
console.log(`   emergency deck / far room ....... ${deck(emer)} / ${far(emer)}`);
if (emer.maxAll === 0) console.log('   !! the probe cannot report anything — it is not measuring the light');

await browser.close();
