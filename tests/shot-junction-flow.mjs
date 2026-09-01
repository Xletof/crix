// EVIDENCE — REACTOR JUNCTION ENEMY FLOW, ring against shipped topology.
//
//   node tests/shot-junction-flow.mjs
//
// §18's crowd stress test, photographed. A dense wave enters from all three
// feeder gates at once against a player standing on the objective, and the same
// wave is run twice: once with the room's original eight-cover ring reinstated
// through a cloned spec, once with what ships. Matched seed, matched stations,
// matched elapsed time.
//
// THE PLAYER IS MADE UNKILLABLE AND UNHURTABLE. The first attempt at this
// photographed a full-screen damage wash instead of a room — the rig had spawned
// a dense sector-30 wave on top of the player, which is a fight and not a flow
// measurement.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const URL = 'http://localhost:5173/?nodlg=1&nofreeze=1';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const OUT = 'docs/evidence/arena-pilot/junction-flow';
mkdirSync(OUT, { recursive: true });

const RING = [
  { x: 700, y: 420, tex: 'ch-con-heavy' }, { x: 700, y: 980, tex: 'rj-cab-a' },
  { x: 420, y: 700, tex: 'ch-con-ped-b' }, { x: 980, y: 700, tex: 'ch-con-ped-a' },
  { x: 500, y: 500, tex: 'rj-cab-b' }, { x: 900, y: 500, tex: 'rj-cab-a' },
  { x: 500, y: 900, tex: 'rj-cab-b' }, { x: 900, y: 900, tex: 'rj-cab-a' },
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

const shot = async (name) => {
  const buf = await page.screenshot();
  writeFileSync(`${OUT}/${name}.png`, buf);
  console.log('  ', name);
};

const run = async (tag, cover) => {
  await page.evaluate(async ({ cover }) => {
    const gs = window.game.scene.getScene('Game');
    const { ROOMS } = await import('/src/data/rooms.js');
    const { snapAll } = await import('/src/data/mapUtils.js');
    const { ENDLESS } = await import('/src/config.js');
    const base = ROOMS.find((r) => r.id === 'corridor');
    gs.sector = 6 * ENDLESS.bossEvery;
    gs.loadRoom(cover ? { ...base, cover: snapAll(cover) } : base);
    await new Promise((r) => setTimeout(r, 2200));
    gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
    gs._sectorTint?.setAlpha(0);
    // NEUTRALISE THE ROOM MODIFIER IN BOTH RUNS. Endless rolls one per room
    // load off `rng.waves`, so two consecutive loads of the same room get
    // different ones — the first version of this pair came back DARKNESS
    // against FRENZY, which is a different enemy speed and a different ambient
    // wash in a comparison that is supposed to differ only in cover.
    gs._roomModifier = null;
    gs.events.emit('modifier-active', null, null);
    gs.events.emit('set-darkness', false);
  }, { cover });
  await page.waitForTimeout(4200); // let the room banner clear

  await page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    gs.player.setPosition(700, 700);
    gs.player.hp = 1e9; gs.player.hpMax = 1e9; gs.lives = 9999;
    gs.arenaActive = true;
    // Six per gate, all three gates, all at once.
    [{ x: 700, y: 100 }, { x: 100, y: 700 }, { x: 1300, y: 700 }].forEach((g) => {
      for (let i = 0; i < 6; i++)
        gs.spawnEnemyAt(i % 3 === 2 ? 'shooter' : 'grunt',
          g.x + ((i * 61) % 140) - 70, g.y + ((i * 43) % 140) - 70, {});
    });
    // Pin and protect the player for the whole run.
    window.__pin = () => {
      gs.player.setPosition(700, 700);
      gs.player.body.setVelocity(0, 0);
      gs.player.hp = gs.player.hpMax;
      gs.player.iFrames = 1e9;
    };
    gs.events.on('postupdate', window.__pin);
  });

  // Three beats of the same approach: entering, converging, arrived.
  for (const [i, ms] of [[0, 1400], [1, 1600], [2, 2200]]) {
    await page.waitForTimeout(ms);
    await page.evaluate(() => {
      const gs = window.game.scene.getScene('Game');
      const hud = window.game.scene.getScene('HUD');
      // Screen-locked full-viewport overlays are HUD state, not room state, and
      // they would photograph as a wash over the thing being compared.
      hud?._hitArcs?.splice(0);
      hud?.hitArcGfx?.clear();
      for (const ov of Object.values(hud?._overlays || {})) ov.setAlpha(0);
      // AND THE SECTOR WASH. `_sectorTint` is an ADD-blended screen-locked
      // rectangle at depth 9000 and it comes back after the room banner, so
      // zeroing it once at load is not enough — the first run of this rig
      // photographed six frames of flat red instead of a room.
      gs._sectorTint?.setAlpha(0);
      // AND THE CAMERA FLASH. `player-hurt` fires `flash(120, 255, 80, 80)`
      // and `scene.pause()` stops the effect updating, so a shutter that lands
      // inside one photographs a FROZEN full-screen red wash that never
      // decays — six frames of flat red instead of a room, twice, before this
      // was found. It is not an object in any display list, which is why
      // walking the children finds nothing.
      gs.cameras.main.resetFX?.();
      gs.scene.pause();
    });
    await shot(`${tag}-${i}`);
    await page.evaluate(() => window.game.scene.getScene('Game').scene.resume());
  }

  await page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    gs.events.off('postupdate', window.__pin);
    gs.arenaActive = false;
    gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  });
};

console.log('— ring —');
await run('ring', RING);
console.log('— shipped —');
await run('shipped', null);
console.log(OUT);
await browser.close();
