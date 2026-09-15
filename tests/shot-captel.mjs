// EVIDENCE — THE CAPTAIN TELEMETRY PANEL, AT HANDSET SCALE.
//
//   node tests/shot-captel.mjs
//
// A passing structural test is not a readable overlay. This photographs both
// states the human will actually see — the live one-liner during the fight and
// the full card after the Captain is gone — at 720x1280 with nothing scaled, so
// the question "can I read this on a phone, and is it in the way" has a picture
// behind it rather than an opinion.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = 'docs/evidence/champion-reset/captel';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
page.on('pageerror', (e) => console.error('PAGE ERROR', String(e).slice(0, 300)));

await page.goto('http://localhost:5173/?nodlg=1&nofreeze=1&champdbg=1&captel=1');
await page.waitForTimeout(4500);
await page.mouse.click(360, 640);
await page.waitForTimeout(800);
await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 4242 }));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(3000);

const shot = async (n) => { writeFileSync(`${OUT}/${n}.png`, await page.screenshot()); console.log('  ', n); };
const hush = () => page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs.cameras.main.resetFX();
  gs._sectorTint?.setAlpha(0);
  window.game.scene.getScene('HUD')?.hud?.banner?.setAlpha(0);
  gs.scene.pause();
});

// A REAL FIGHT, not a staged one: the wave runs, the Captain fights, and the
// player's damage goes in through the real paths so the panel is filled by the
// same code a handset run would fill it with.
await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { setGodMode } = await import('/src/systems/debug.js');
  setGodMode(true);
  gs.lives = 9999;
  const c = gs.spawnChampion(gs.player.x + 380, gs.player.y - 60, 'captain');
  window.__cap = c;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  // Four supers at the cadence the brief says a real player reaches, plus chip
  // fire between them — enough that every row of the card has a real number.
  for (let i = 0; i < 4; i++) {
    gs.player.superCharge = 999;
    gs.player._suppressedMs = 0;
    gs.player.tryFireSuper(Math.atan2(c.y - gs.player.y, c.x - gs.player.x));
    for (let k = 0; k < 3; k++) {
      gs._dmgSrc = 'primary';
      if (c.alive) c.damage(70, { x: 20, y: 0 });
      gs._dmgSrc = null;
      await wait(120);
    }
    await wait(700);
  }
});
await page.waitForTimeout(1200);
await hush();
await page.waitForTimeout(250);
await shot('01-live-ticker');

await page.evaluate(() => window.game.scene.getScene('Game').scene.resume());
await page.waitForTimeout(300);
await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const c = window.__cap;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  // Finish him through the melee path, so the card carries a MELEE row too.
  while (c.alive) {
    gs._dmgSrc = 'melee';
    c.damage(600, { x: 40, y: 0 });
    gs._dmgSrc = null;
    await wait(90);
  }
});
await page.waitForTimeout(900);
await hush();
await page.waitForTimeout(250);
await shot('02-summary-card');

const text = await page.evaluate(() => window.game.scene.getScene('Game')._captel.report());
console.log('\n' + text + '\n');
await browser.close();
