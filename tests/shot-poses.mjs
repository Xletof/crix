// Look at the attack pose frames.
//
// No assertions on purpose. The busts needed two rounds because the first pass
// read as a robot head on a plinth, and a 1px bob is exactly the kind of thing
// that looks fine in code and is invisible on a phone. Post-mortem rule 6.
//
//   npm run dev, then: node tests/shot-poses.mjs

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const URL = process.env.FRIX_URL || 'http://localhost:5173/?nodlg=1';
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

const missing = await page.evaluate(() => {
  const s = window.game.scene.getScene('Title');
  const g = s.add.graphics().setDepth(9000);
  g.fillStyle(0x0c1018, 1);
  g.fillRect(0, 0, 720, 1280);

  const label = (x, y, t, col = '#8fdfae', size = 18) => s.add.text(x, y, t, {
    fontFamily: 'monospace', fontSize: `${size}px`, color: col,
  }).setOrigin(0.5).setDepth(9003);

  const sheets = ['grunt', 'shooter'];
  const dirs = ['front', 'back', 'side'];
  const poses = ['idle', 'raise', 'thrust', 'recoil'];
  const absent = [];

  // The sheet is 20x20 logical at scale 4, so a FRAME is already 80px. The
  // first pass drew them at setScale(4) on top of that — 320px sprites in a
  // 145px grid, i.e. a pile. Two is the most that fits four poses across 720.
  let row = 0;
  sheets.forEach((sheet) => {
    dirs.forEach((d) => {
      const rowY = 110 + row * 196;
      row++;
      label(46, rowY, `${sheet}\n${d}`, '#5a6a80', 15);
      poses.forEach((p, pi) => {
        const key = `${sheet}-${p}-${d}`;
        if (!s.anims.exists(key)) { absent.push(key); return; }
        const frame = s.anims.get(key).frames[0].frame.name;
        const x = 150 + pi * 165;
        // A floor line, so BOB and LEAN are readable against something fixed.
        const fl = s.add.graphics().setDepth(9001);
        fl.fillStyle(0x2a3444, 1);
        fl.fillRect(x - 70, rowY + 62, 140, 2);
        s.add.image(x, rowY, sheet, frame).setScale(2).setDepth(9002);
        if (row === 1) label(x, 34, p, '#ffd040', 17);
      });
    });
  });
  return absent;
});

if (missing.length) console.error('MISSING ANIMS:', missing.join(', '));

await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/poses.png` });
console.log(`wrote ${OUT}/poses.png`);

await browser.close();
