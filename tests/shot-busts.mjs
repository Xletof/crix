// Look at the portrait busts.
//
// There is no assertion here and there should not be. `docs/POST-MORTEM-vader-
// moves.md` rule 6: screenshots caught three bugs no check did, including a
// saber whose scale compounded 35% per throw until it lay across the room. A
// count of drawn pixels cannot tell you a stormtrooper helmet looks like a
// stormtrooper helmet.
//
//   npm run dev, then: node tests/shot-busts.mjs

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const URL = process.env.FRIX_URL || 'http://localhost:5173/';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const OUT = process.env.SHOT_DIR || '/tmp/frix-shots';

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
page.on('pageerror', (e) => console.error('PAGE ERROR', e.message));

await page.goto(URL);
await page.waitForFunction(() => !!window.game?.scene?.getScene('Title'), null, { timeout: 20000 });
await page.waitForTimeout(1200);

// Draw every bust into the Title scene at display size, on the dark plate
// colour the dialogue card will use, with labels.
const missing = await page.evaluate(() => {
  const s = window.game.scene.getScene('Title');
  const keys = ['bust-grunt', 'bust-shooter', 'bust-bomber', 'bust-shielded', 'bust-sniper', 'bust-vader'];
  const absent = keys.filter((k) => !s.textures.exists(k));

  const g = s.add.graphics().setDepth(9000);
  g.fillStyle(0x04140c, 1);
  g.fillRect(0, 0, 720, 1280);

  keys.forEach((k, i) => {
    if (!s.textures.exists(k)) return;
    const x = 180 + (i % 2) * 360;
    const y = 220 + Math.floor(i / 2) * 380;
    // Backing glow, as the card will do it — the bust is never tinted.
    const glow = s.add.graphics().setDepth(9001);
    glow.fillStyle(0xff5030, 0.22);
    glow.fillCircle(x, y, 120);
    s.add.image(x, y, k).setDepth(9002);
    s.add.text(x, y + 130, k.replace('bust-', '').toUpperCase(), {
      fontFamily: 'monospace', fontSize: '26px', color: '#8fdfae',
    }).setOrigin(0.5).setDepth(9003);
  });
  return absent;
});

if (missing.length) console.error('MISSING TEXTURES:', missing.join(', '));

await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/busts.png` });
console.log(`wrote ${OUT}/busts.png`);

await browser.close();
