// THE ONE OPEN QUESTION THE PILOT COULD NOT DECIDE FOR ITSELF.
//
// `LIGHTSOUT.floor` / `.wall` / `.prop` are the multiplicative tints the arena
// takes when the chamber loses power. They came out of a handset verdict and
// `smoke-vader` freezes them, so the pilot SHIPPED THEM UNCHANGED — but the
// constraint that originally pinned them (a lighter tint left the old crimson
// strip lights legible and the room came back maroon) no longer exists, because
// the pilot deck has no red in it at all.
//
// So this rig photographs one frozen frame twice: at the shipped values, and at
// the raised values the pass tried. Both with the same room, the same camera and
// the same boss pose. It is EVIDENCE FOR A DECISION, not a test — there is
// nothing here to pass or fail.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = 'docs/evidence/arena-pilot/ambient-ab';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
page.on('pageerror', (e) => console.error('PAGE ERROR', e));

await page.goto('http://localhost:5173/?nodlg=1&nofreeze=1');
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
  gs.sector = 6 * ENDLESS.bossEvery;
  gs.loadRoom(ROOMS.find((r) => r.boss));
  await new Promise((r) => setTimeout(r, 2200));
  gs.arenaActive = false;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  if (!gs.boss?.alive) { gs.spawnBoss(900, 900); await new Promise((r) => setTimeout(r, 700)); }
  gs.lives = 9999;
  if (gs._sectorTint?.active) gs._sectorTint.setAlpha(0);   // not the arena — see shot-arena-pilot
});
await page.waitForTimeout(600);

const shoot = async (name, floor, wall, prop) => {
  await page.evaluate(async ([f, w, p]) => {
    const gs = window.game.scene.getScene('Game'), b = gs.boss, F = 1e9;
    const { LIGHTSOUT } = await import('/src/config.js');
    gs.scene.resume();
    if (b) { b._blackoutT = F; b._afterimageT = F; b._disarmT = F; b._sunderT = F;
             b._reflectT = F; b.cooldown = F; b._moveT = F; b._attackT = F; b.hp = b.hpMax; }
    gs.player.hp = gs.player.hpMax;
    gs.player.setPosition(800, 900); gs.player.setVelocity(0, 0);
    b?.setPosition(800, 620); b?.setVelocity(0, 0);
    gs.cameras.main.centerOn(800, 900);
    // Reset to a lit room first, so the snapshot the tint lerp reads is clean.
    gs._darkChain?.stop?.();
    if (gs._darkMix) gs._darkMix.v = 0;
    gs._applyDarkMix(); gs._restoreArenaTints();
    LIGHTSOUT.floor = f; LIGHTSOUT.wall = w; LIGHTSOUT.prop = p;
    gs._enterDarkArena();
    gs._darkChain?.stop?.();
    gs._darkMix.v = 1; gs._applyDarkMix();
    const hud = window.game.scene.getScene('HUD');
    hud.setDarkness(true, 'blackout');
    hud._darkTweens.blackout?.stop?.();
    hud._overlays.blackout.setAlpha(1);
  }, [floor, wall, prop]);
  await page.waitForTimeout(220);
  await page.evaluate(() => window.game.scene.getScene('Game').scene.pause());
  writeFileSync(`${OUT}/${name}.png`, await page.screenshot());
  console.log('  ', name);
};

await shoot('a-shipped-0x12151f', 0x12151f, 0x1a1f2b, 0x2e3446);
await shoot('b-raised-0x2e3648', 0x2e3648, 0x3a4356, 0x3e4658);
await browser.close();
console.log(`\nevidence -> ${OUT}`);
