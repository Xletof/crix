// Frame sequence across a whole attack run. Numbers said the model is sound;
// this is the part that says whether it READS as missiles.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const OUT = new URL('./out/', import.meta.url).pathname;

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
await page.goto('http://localhost:5173/');
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

// God mode, so the full-screen damage vignette does not wash out the frames.
await page.evaluate(async () => {
  const url = performance.getEntriesByType('resource').map((r) => r.name)
    .find((n) => /systems\/debug\.js/.test(n));
  if (url) (await import(url)).setGodMode(true);
});

await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  const p = gs.player;
  p.hp = p.hpMax;
  const live = gs.enemies.getChildren().filter((e) => e.alive);
  const spots = [[-260, -300], [-60, -380], [160, -320], [330, -180]];
  live.slice(0, 4).forEach((e, i) => {
    e.x = p.x + spots[i][0]; e.y = p.y + spots[i][1];
    e.body?.reset(e.x, e.y); e.hp = 999999; e.hpMax = 999999; e.speed = 0;
  });
  live.slice(4).forEach((e) => { e.x = p.x - 1400; e.y = p.y - 1400; e.body?.reset(e.x, e.y); });
  p.equipSecondary('cluster');
  p.fireCooldown = 0;
  p.tryFire(-Math.PI / 2);
  p._equipNothing();
});

await page.waitForFunction(() => {
  const gs = window.game.scene.getScene('Game');
  return gs.playerFragBullets.getChildren().some((b) => b.active);
}, null, { timeout: 15000 });

// Steps across the run: pop -> ignition -> bank -> dive -> impact.
const steps = [0, 250, 400, 350, 350, 400];
for (let i = 0; i < steps.length; i++) {
  await page.waitForTimeout(steps[i]);
  await page.screenshot({ path: `${OUT}/run-${i}.png` });
}
await browser.close();
console.log('captured', steps.length, 'frames');
