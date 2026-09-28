// EVIDENCE — THE VANGUARD SCREEN, old vs new, at 1x.
//
//   node tests/shot-vanguard-screen.mjs            all variants
//   node tests/shot-vanguard-screen.mjs B-new      one variant
//
// OLD is `&noscreen=1`, which takes the role away and runs the stock Shielded
// branch — the exact code the handset played on `5a97fd4`. NEW is the build.
// Same seed, same room, same wave, modifier nulled, so a pair differs only in
// where the shields stop.
//
// DIAGNOSTIC STILLS, NOT A VERDICT. The player is invulnerable and scripted:
// planted, then a lateral strafe at close range, then a dash round the line,
// then the tail — everything but the Shieldeds removed and the Super meter
// EMPTY (it is zeroed, never precharged). Full-speed handset play decides.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = 'docs/evidence/vanguard-screen';
const BASE = 'http://localhost:5173/?nodlg=1&nofreeze=1&encdbg=1&room=hangar&sector=8&wave=2';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
mkdirSync(OUT, { recursive: true });

const VARIANTS = {
  'B-old': '&nochamp=1&noscreen=1',
  'B-new': '&nochamp=1',
  'A-old': '&noscreen=1',
  'A-new': '',
};
const only = process.argv[2];

const browser = await chromium.launch({ executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'] });

for (const [tag, q] of Object.entries(VARIANTS)) {
  if (only && only !== tag) continue;
  console.log(tag);
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  page.on('pageerror', (e) => console.error('PAGE ERROR', String(e)));
  await page.goto(BASE + q);
  await page.waitForTimeout(4500);
  await page.mouse.click(360, 640);
  await page.waitForTimeout(800);
  await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 4242 }));
  await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?._wave, null, { timeout: 20000 });

  // Invulnerable, 560px in front of the formation's single gate, room
  // modifier nulled. The player never shoots unless a frame says so.
  await page.evaluate(async () => {
    const { setGodMode } = await import('/src/systems/debug.js');
    setGodMode(true);
    const gs = window.game.scene.getScene('Game');
    gs.lives = 9999;
    gs._roomModifier = null;
    gs.events.emit('modifier-active', null, null);
    gs.events.emit('set-darkness', false);
    const g = (gs._gatePlan && gs._gatePlan[0]) || gs.roomSpec.gates[0];
    const cx = gs.roomSpec.bounds.w / 2, cy = gs.roomSpec.bounds.h / 2;
    const dx = cx - g.x, dy = cy - g.y, d = Math.hypot(dx, dy) || 1;
    gs.player.setPosition(g.x + (dx / d) * 560, g.y + (dy / d) * 560);
    gs.cameraDirector?.reset(gs.player.x, gs.player.y);
    window.__gate = g;
  });

  const shoot = async (name) => {
    await page.evaluate(() => {
      const gs = window.game.scene.getScene('Game');
      gs._sectorTint?.setAlpha(0);
      gs.cameras.main.resetFX();
      window.game.scene.getScene('HUD')?.hud?.banner?.setAlpha(0);
      gs.scene.pause();
    });
    writeFileSync(`${OUT}/${tag}-${name}.png`, await page.screenshot());
    const st = await page.evaluate(() => {
      const gs = window.game.scene.getScene('Game');
      const p = gs.player;
      const sh = gs.enemies.getChildren().filter((e) => e.alive && e._archetype === 'shielded');
      const alive = gs.enemies.getChildren().filter((e) => e.alive);
      return {
        shields: sh.map((e) => Math.round(Math.hypot(e.x - p.x, e.y - p.y))).sort((a, b) => a - b),
        alive: alive.length, captain: alive.some((e) => e.isChampion),
        superCharge: Math.round(p.superCharge * 10) / 10,
      };
    });
    await page.evaluate(() => window.game.scene.getScene('Game').scene.resume());
    console.log(`   ${name}  shield dist ${st.shields.join('/') || '-'}  alive ${st.alive}${st.captain ? ' +captain' : ''}  super ${st.superCharge}`);
  };
  // Hold a stick direction for `ms` (the HUD writes zero every frame when no
  // finger is down, so the rig re-asserts it on its own short clock).
  const hold = (vx, vy, ms) => page.evaluate(async ([x, y, t]) => {
    const p = window.game.scene.getScene('Game').player;
    const t0 = Date.now();
    while (Date.now() - t0 < t) { p.setMoveInput({ x, y, force: 1 }); await new Promise((r) => setTimeout(r, 30)); }
    p.setMoveInput({ x: 0, y: 0, force: 0 });
  }, [vx, vy, ms]);
  // The unit vector from the player to the formation's gate, and its normal.
  const axes = () => page.evaluate(() => {
    const p = window.game.scene.getScene('Game').player, g = window.__gate;
    const dx = g.x - p.x, dy = g.y - p.y, d = Math.hypot(dx, dy) || 1;
    return { fx: dx / d, fy: dy / d, nx: -dy / d, ny: dx / d };
  });

  await page.waitForTimeout(2400);
  await shoot('1-entry');
  await page.waitForTimeout(2600);
  await shoot('2-advancing');
  await page.waitForTimeout(4200);
  await shoot('3-settled');
  // Close-range lateral footwork along the line's normal.
  const ax = await axes();
  await hold(ax.nx, ax.ny, 700);
  await shoot('4-lateral');
  // A dash round the flank: stick sideways and dash.
  await page.evaluate(([x, y]) => {
    const p = window.game.scene.getScene('Game').player;
    p.setMoveInput({ x, y, force: 1 });
    p.tryDash();
  }, [ax.nx, ax.ny]);
  await page.waitForTimeout(260);
  await shoot('5-dash');
  await hold(0, 0, 50);

  // THE TAIL: every non-Shielded gone, at most two Shieldeds, Super EMPTY.
  await page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    gs.arenaCfg.spawnRate = 60;
  });
  await page.waitForFunction(() => window.game.scene.getScene('Game')._wavePhase !== 'spawning', null, { timeout: 20000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    const alive = gs.enemies.getChildren().filter((e) => e.alive);
    const shields = alive.filter((e) => e._archetype === 'shielded');
    alive.filter((e) => e._archetype !== 'shielded').forEach((e) => e.die());
    shields.slice(2).forEach((e) => e.die());
    gs.player.superCharge = 0;
    // Back to open floor: the strafe and the dash above can carry the player
    // to a wall, and a tail photographed against the room edge shows the wall.
    gs.player.setPosition(gs.roomSpec.bounds.w / 2, gs.roomSpec.bounds.h / 2);
    gs.player.setVelocity(0, 0);
  });
  // Poll for the shields to STOP, not a fixed sleep — game time runs slower
  // than wall time in this harness, and a fixed window photographs the walk.
  const t0 = Date.now();
  await page.waitForTimeout(1500);
  while (Date.now() - t0 < 15000) {
    const moving = await page.evaluate(() => window.game.scene.getScene('Game').enemies.getChildren()
      .some((e) => e.alive && e._archetype === 'shielded' && Math.hypot(e.body.velocity.x, e.body.velocity.y) > 1));
    if (!moving) break;
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(600);
  await shoot('6-tail-no-super');
  await page.close();
}

await browser.close();
console.log(`frames in ${OUT}`);
