// Look at the dialogue card, in every shape it takes.
//
// Four captures: a returning grudge (short name), an heir (the LONG name, which
// is where the nameplate overruns if the size step is wrong), a kill, and
// Vader. Post-mortem rule 6 — screenshots caught three bugs no assertion did.
//
// The card pauses Game and HUD itself, so no clock-freezing is needed here: it
// is a static overlay by construction, which is exactly why it is capturable
// and short-lived FX are not.
//
//   npm run dev, then: node tests/shot-dialogue.mjs

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
await page.waitForTimeout(4500);
await page.mouse.click(360, 640);
await page.waitForTimeout(800);
await page.evaluate(() => window.game.scene.getScene('Title')
  .scene.start('Game', { mode: 'endless', seed: 20260101 }));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(1500);

const CASES = [
  {
    file: 'dialogue-return',
    spec: {
      bust: 'bust-sniper',
      name: 'THRAX, WHO BLED YOU',
      color: '#ff5030',
      sub: 'IT REMEMBERS YOUR BLOOD',
      text: 'I still have your blood on the deck\nof sector 4. I came back for\nthe rest of it.',
      traits: ['armored', 'volatile'],
    },
  },
  {
    // The long-name case. `displayName` produces "X, HEIR OF Y" and the
    // nameplate steps down a size for it — this is the capture that shows
    // whether the step is enough.
    file: 'dialogue-heir',
    spec: {
      bust: 'bust-shielded',
      name: 'IRONJAW, HEIR OF CARRION',
      color: '#40c0ff',
      sub: 'AVENGING CARRION',
      text: "They gave me CARRION's post.\nThey gave me the armour too.\nIt does not fit yet.",
      traits: ['armored', 'colossal', 'regenerator'],
    },
  },
  {
    file: 'dialogue-kill',
    spec: {
      bust: 'bust-grunt',
      name: 'VOSS, WHO SURVIVED YOU',
      color: '#ffd040',
      sub: 'DOWN',
      text: 'Someone is behind me.\nThere is always someone behind me.',
      traits: ['swift'],
    },
  },
  {
    file: 'dialogue-vader',
    spec: {
      bust: 'bust-vader',
      name: 'DARTH VADER',
      color: '#ff2828',
      sub: 'ENCOUNTER 4',
      text: 'You made me withdraw.\nNo one has done that in a long time.\nI have thought about it since.',
      traits: [],
    },
  },
];

for (const c of CASES) {
  await page.evaluate((spec) => {
    const gs = window.game.scene.getScene('Game');
    if (gs.scene.isActive('Dialogue')) gs.scene.stop('Dialogue');
    gs._dialogueOpen = false;
    gs._dialogueQueue = [];
    gs.queueDialogue(spec);
  }, c.spec);

  // Let the typewriter finish — 26ms/char at ~20fps headless is generous, and
  // the point of the shot is the FULL line, not a third of it.
  await page.waitForTimeout(7000);
  await page.screenshot({ path: `${OUT}/${c.file}.png` });
  console.log(`wrote ${OUT}/${c.file}.png`);

  await page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    gs.scene.stop('Dialogue');
    if (gs.scene.isPaused('Game')) gs.scene.resume('Game');
    if (gs.scene.isPaused('HUD')) gs.scene.resume('HUD');
    gs._dialogueOpen = false;
  });
  await page.waitForTimeout(400);
}

await browser.close();
