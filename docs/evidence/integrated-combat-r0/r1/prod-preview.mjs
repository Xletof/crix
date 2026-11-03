// The PRODUCTION bundle (vite build + vite preview), no flags and ?baseline=legacy:
// it boots with no page errors and no debug hooks, reaches gameplay through the
// real title flow, and the enemies wear the art each baseline names.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const BASE = process.argv[2] || 'http://localhost:4173/';
const OUT = process.argv[3] || '.';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'  /* tests/README.md: Environment */, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
for (const [tag, q] of [['default', ''], ['legacy', '?baseline=legacy']]) {
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  await page.goto(BASE + q);
  await page.waitForTimeout(6000);
  const hooks = await page.evaluate(() => ({ game: typeof window.game, canvas: !!document.querySelector('canvas') }));
  await page.mouse.click(360, 1000); await page.waitForTimeout(2500);    // ENDLESS
  for (let k = 0; k < 4; k++) { await page.mouse.click(360, 900); await page.waitForTimeout(1500); }   // past any intro / dialogue card
  await page.waitForTimeout(14000);
  await page.screenshot({ path: `${OUT}/prod-${tag}.png` });
  console.log(tag, JSON.stringify({ url: BASE + q, hooks, errors }));
  await page.close();
}
await browser.close();
