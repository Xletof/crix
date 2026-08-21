// LIGHTS OUT and ECLIPSE, photographed on the real production path.
//
// Nothing is forced except the mechanic's own event: the boss fires
// `boss-blackout` / `boss-afterimages` exactly as his clocks would. Screenshots
// only — the numbers live in diag-lights-ab.mjs, which measures a frozen frame.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';

const URL = 'http://localhost:5173/?nodlg=1&nofreeze=1';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const OUT = 'docs/evidence/mech-truth';

const browser = await chromium.launch({ executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
page.on('pageerror', (e) => console.error('PAGE ERROR', e.message));
await page.goto(URL);
await page.waitForTimeout(4500);
await page.mouse.click(360, 640);
await page.waitForTimeout(800);
await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 777 }));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(1500);

await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { ROOMS } = await import('/src/data/rooms.js');
  const { ENDLESS } = await import('/src/config.js');
  gs.sector = 6 * ENDLESS.bossEvery;           // encounter 6 — the ECLIPSE rung
  gs.loadRoom(ROOMS.find((r) => r.boss));
  await new Promise((r) => setTimeout(r, 2600));
  gs.arenaActive = false;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  if (!gs.boss?.alive) { gs.spawnBoss(940, 620); await new Promise((r) => setTimeout(r, 900)); }
  // Centre of the arena. Near a wall the game camera CLAMPS, which pins the
  // pocket to one edge of the screen — true to play, useless for a photograph
  // of the composition.
  gs.player.setPosition(800, 800);
  // The camera LERPS (0.22). After a teleport it spends a second catching up,
  // and the pocket tracks the PLAYER — so a shot taken mid-lerp photographs
  // the player off the edge of their own sight radius.
  gs.cameras.main.centerOn(800, 800);
  gs.player.hp = gs.player.hpMax; gs.lives = 9999;
  const b = gs.boss, FAR = 1e9;
  b._blackoutT = FAR; b._afterimageT = FAR; b._disarmT = FAR; b._sunderT = FAR; b._reflectT = FAR;
  // HIS ATTACK CLOCKS ARE SILENCED FOR THE PHOTOGRAPH. What is under test here
  // is what the room looks like when the lights go out, and a boss mid-charge
  // answers that with a red hurt-flash over the whole screen. The mechanics
  // themselves are still fired through their real events below.
  b.cooldown = FAR; b._moveT = FAR;
});
await page.waitForTimeout(1200);

const shot = async (n, name) => { writeFileSync(`${OUT}/lo-${n}-${name}.png`, await page.screenshot()); };
const fire = (evt, ...args) => page.evaluate(([e, a]) => {
  const gs = window.game.scene.getScene('Game');
  gs.events.emit(e, gs.boss, ...a);
}, [evt, args]);

await shot(1, 'normal');
await fire('boss-blackout', 4200);
await page.waitForTimeout(60);  await shot(2, 'transition-60ms');
await page.waitForTimeout(70);  await shot(3, 'transition-130ms');
await page.waitForTimeout(120); await shot(4, 'settled-250ms');
await page.waitForTimeout(750); await shot(5, 'vader-in-the-dark');

// ECLIPSE. His attack clocks are silenced FOR THE PHOTOGRAPH ONLY — the
// question here is "can you tell which one is him", and a boss mid-combo
// answers it by moving. The mechanic itself runs on its real path.
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game'), b = gs.boss;
  gs.player.hp = gs.player.hpMax;
  b.setPosition(gs.player.x + 30, gs.player.y - 210);
});
await fire('boss-afterimages', 3);
await page.waitForTimeout(900);
// PROVE THE CLONES EXIST BEFORE PHOTOGRAPHING THEM. `_spawnAfterimages` goes
// through `spawnEnemyAt`, which can decline — a shot of "eclipse" with zero
// clones in it is the classic vacuous pass.
const clones = await page.evaluate(() => window.game.scene.getScene('Game')
  .enemies.getChildren().filter((e) => e.alive && e._afterimage).length);
console.log(`  afterimages alive for the eclipse shot: ${clones}`);
await shot(6, 'eclipse-afterimages');
await page.waitForTimeout(3200); await shot(7, 'restored');
console.log('shots written to', OUT);
await browser.close();
