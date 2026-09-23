// EVIDENCE — CHARACTER PUNCTUATION AMONG REAL COMBAT TEXT.
//
//   node tests/shot-captain-punct.mjs [tag]
//
// The handset lost the bone glyphs in real combat because every frame that
// raises one also prints damage numbers in the same column. So every frame here
// is taken with REAL numbers in it, produced the only honest way: real hits
// through `damage()`, which emits `enemy-hit`, which is what prints them. The
// CRIT is real as well — `GameScene` calls one on any hit whose displayed
// figure is >= 400 — and it lands on an ordinary enemy standing beside him,
// because a 400 on the Captain is over `staggerMinDamage` (260) and a stagger
// correctly takes his wind-up, and the intent sign with it.
//
// Run it on the current build and on a stash of the previous one with a
// different tag: the pair is the A/B.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const TAG = process.argv[2] || 'vx';
const OUT = `docs/evidence/champion-reset/${TAG}`;
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
page.on('pageerror', (e) => console.error('PAGE ERROR', String(e).slice(0, 300)));

await page.goto('http://localhost:5173/?nodlg=1&nofreeze=1&champdbg=1');
await page.waitForTimeout(4500);
await page.mouse.click(360, 640);
await page.waitForTimeout(800);
await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 707 }));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(1500);
await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { ROOMS } = await import('/src/data/rooms.js');
  gs.loadRoom(ROOMS.find((r) => r.id === 'hangar'));
  await new Promise((r) => setTimeout(r, 2200));
  gs.lives = 9999;
  const { setGodMode } = await import('/src/systems/debug.js');
  setGodMode(true);
  gs.arenaActive = false;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  gs.player.setPosition(700, 1060); gs.player.setVelocity(0, 0);
});
await page.waitForTimeout(400);

const resume = () => page.evaluate(() => window.game.scene.getScene('Game').scene.resume());

// A fresh Captain per station, with two ordinary enemies beside him so the
// frame is a crowd rather than a portrait.
const stage = () => page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs.events.removeAllListeners('postupdate');
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  const c = gs.spawnChampion(660, 700, 'captain');
  c.die = () => { c.hp = Math.max(c.hp, 50); };
  c._stepCd = 1e9;                       // no step mid-shutter; photography only
  window.__cap = c;
  // `spawnEnemyAt(type, x, y)` — type FIRST. The previous rig passed
  // (x, y, type), which quietly spawned nothing that was asked for.
  gs.spawnEnemyAt('grunt', 590, 690);
  gs.spawnEnemyAt('shooter', 760, 740);
  window.__adj = gs.enemies.getChildren().filter((e) => e.alive && !e.isChampion);
  window.__adj.forEach((e) => { e.cooldown = 1e9; });
});

// Shoot when `armExpr` is true: run `hit` on that frame, then pause `after`
// frames later if `holdExpr` still holds.
const moment = async (name, armExpr, hitSrc, holdExpr, after = 2) => {
  await page.evaluate(({ armExpr, hitSrc, holdExpr, after }) => {
    const gs = window.game.scene.getScene('Game');
    // eslint-disable-next-line no-new-func
    const arm = new Function('c', 'gs', `return (${armExpr});`);
    // eslint-disable-next-line no-new-func
    const hit = new Function('c', 'gs', hitSrc);
    // eslint-disable-next-line no-new-func
    const hold = new Function('c', 'gs', `return (${holdExpr});`);
    let n = -1;
    const h = () => {
      const c = window.__cap;
      if (n < 0) { if (c?.alive && arm(c, gs)) { hit(c, gs); n = 0; } return; }
      n++;
      if (n < after) return;
      gs.events.off('postupdate', h);
      window.__held = !!hold(c, gs);
      const cam = gs.cameras.main;
      cam.stopFollow(); cam.centerOn(c.x + 20, c.y - 20); cam.resetFX();
      gs._sectorTint?.setAlpha(0);
      window.game.scene.getScene('HUD')?.hud?.banner?.setAlpha(0);
      gs.scene.pause();
    };
    gs.events.on('postupdate', h);
  }, { armExpr, hitSrc, holdExpr, after });
  try {
    await page.waitForFunction(() => window.game.scene.getScene('Game').scene.isPaused(), null, { timeout: 30000 });
  } catch (e) { console.log(`   !! ${name}: never armed`); return; }
  await page.waitForTimeout(250);
  const held = await page.evaluate(() => window.__held);
  writeFileSync(`${OUT}/${name}-1x.png`, await page.screenshot());
  const at = await page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    const cam = gs.cameras.main;
    const c = window.__cap;
    return { x: c.x - cam.scrollX, y: c.y - cam.scrollY + cam.y };
  });
  writeFileSync(`${OUT}/${name}-crop.png`, await page.screenshot({
    clip: { x: Math.max(0, Math.round(at.x - 180)), y: Math.max(0, Math.round(at.y - 230)), width: 360, height: 360 } }));
  console.log('  ', name, held ? '' : '(!! the state it was framed for had already ended)');
};

console.log('character punctuation among real combat text:');

// 1. INTENT, MID-WIND-UP, with numbers on him and a real CRIT beside him.
await resume(); await stage();
await page.evaluate(() => { const c = window.__cap; c._nadeCd = 0; });
await moment('50-intent-among-numbers',
  "c._cap === 'windup' && !!c._intentFx && c._intentFx.alpha > 0.5",
  "c.damage(140); c.damage(90); c.damage(210); const g = window.__adj?.[0]; if (g?.alive) g.damage(620);",
  "c._cap === 'windup' && !!c._intentFx");

// 2. THE ARMOUR BREAK GLYPH, with a CRIT and ordinary numbers.
await resume(); await stage();
await moment('51-break-among-numbers',
  "true",
  "c.armour = 60; c.damage(300); c.damage(120); const g = window.__adj?.[0]; if (g?.alive) g.damage(620);",
  "c.armourBroken || c.armour <= 0", 2);

// 3. LOW HEALTH, with the same crowd of text.
await resume(); await stage();
await moment('52-lowhealth-among-numbers',
  "true",
  "c.armour = 0; c.hp = Math.round(c.hpMax * c.def.lowHealthFrac) + 120; c.damage(240); c.damage(100); const s = window.__adj?.[1]; if (s?.alive) s.damage(80);",
  "true", 2);

await browser.close();
