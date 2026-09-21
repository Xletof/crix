// EVIDENCE — THE ARC GRENADE AS A DEVICE, AND ITS FIELD AS A CONSEQUENCE.
//
//   node tests/shot-arcfield.mjs [tag]
//
// §30 is explicit that this may not be approved from a single screenshot: the
// ACTIVATION SEQUENCE is the claim — device, then nodes, then perimeter, then
// connections — and a sequence cannot be photographed once. The stations below
// walk the whole lifecycle, and the last one is the only frame that answers
// §26: a live Captain standing beside his own field, to ask whether the floor
// effect has become the character.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const TAG = process.argv[2] || 'vf';
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
await page.waitForTimeout(500);

const shot = async (n, w = 460) => {
  const at = await page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    const cam = gs.cameras.main;
    const n2 = window.__nade;
    return { x: (n2 ? n2.x : gs.player.x) - cam.scrollX,
      y: (n2 ? n2.y : gs.player.y) - cam.scrollY + cam.y };
  });
  const x = Math.max(0, Math.min(720 - w, Math.round(at.x - w / 2)));
  const y = Math.max(0, Math.min(1280 - w, Math.round(at.y - w / 2)));
  writeFileSync(`${OUT}/${n}.png`, await page.screenshot({ clip: { x, y, width: w, height: w } }));
  console.log('  ', n);
};
const resume = () => page.evaluate(() => window.game.scene.getScene('Game').scene.resume());

// PAUSE ON THE FRAME THE CONDITION IS TRUE, FROM INSIDE THE PAGE. The whole
// activation is 520ms and its first beat is ~90ms of it; an outside poll costs
// 200-400ms a round trip and cannot land inside any of them.
const pauseWhen = async (expr, timeout = 25000) => {
  await page.evaluate((code) => {
    const gs = window.game.scene.getScene('Game');
    // eslint-disable-next-line no-new-func
    const test = new Function('n', 'gs', `return (${code});`);
    const h = () => {
      const n = window.__nade;
      let ok = false;
      try { ok = !!(n && test(n, gs)); } catch (e) { ok = false; }
      if (!ok) return;
      gs.events.off('postupdate', h);
      gs.cameras.main.stopFollow();
      gs.cameras.main.centerOn(n.x, n.y);
      gs.cameras.main.resetFX();
      gs._sectorTint?.setAlpha(0);
      window.game.scene.getScene('HUD')?.hud?.banner?.setAlpha(0);
      gs.scene.pause();
    };
    gs.events.on('postupdate', h);
  }, expr);
  await page.waitForFunction(
    () => window.game.scene.getScene('Game').scene.isPaused(), null, { timeout });
  await page.waitForTimeout(200);
};

const throwOne = () => page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { CHAMPION } = await import('/src/config.js');
  const g = CHAMPION.captain.grenade;
  window.__nade?.destroy?.();
  // THE REAL SPAWN PATH with the real authored spec — nothing about the
  // gameplay object is stubbed, only where it is thrown from.
  window.__nade = gs.spawnArcGrenade({ ...g, x: 700, y: 640, tx: 700, ty: 880 });
});

// ── ONE FRESH GRENADE PER STATION ──────────────────────────────────────────
// THE FIRST VERSION WALKED ONE GRENADE'S WHOLE LIFE, pausing and resuming
// through it, and timed out on the second station. The arming beat is 520ms
// and this harness runs near 12fps, so its first third is barely two frames —
// and resuming from a pause hands Phaser a large delta that steps clean over
// them. Throwing a new one for each station means every window is polled from
// a running start, and the windows below are each a THIRD of the beat rather
// than a sixth, so none of them is a single frame.
console.log('the device, and the field as its consequence:');
const station = async (name, expr, w) => {
  await resume();
  await throwOne();
  await pauseWhen(expr);
  await shot(name, w);
};
const armU = '(n.age - n.flightMs) / n.armMs';
await station('10-device-in-flight', "n.phase === 'flight' && n.age > n.flightMs * 0.4");
await station('11-landed-core-powers-up', `n.phase === 'arm' && ${armU} < 0.34`);
await station('12-nodes-establish', `n.phase === 'arm' && ${armU} > 0.38 && ${armU} < 0.7`);
await station('13-perimeter-closes', `n.phase === 'arm' && ${armU} > 0.74`);
await station('14-field-active', "n.phase === 'field' && n._fieldAge > 200");
await shot('14-field-active-wide', 620);

// THE PLAYER INSIDE IT, AND THE PLAYER ON THE EDGE — §27/§28. The edge frame
// is the one that has to show the painted boundary agreeing with `contains`.
// A FRESH ONE FOR EACH OF THESE TOO — the field lives 1900ms and the previous
// station's has expired by the time the next is set up, which is how the first
// run of this rig timed out with `__nade` pointing at a dead object. The
// player is placed by a FRACTION OF THE REAL RADIUS, read off the live object,
// so the edge frame cannot be positioned by a literal that drifts.
const playerAt = async (name, frac) => {
  await resume();
  await throwOne();
  await page.evaluate((f) => {
    const gs = window.game.scene.getScene('Game');
    const n = window.__nade;
    gs.player.setPosition(n.x + n.radius * f, n.y);
    gs.player.setVelocity(0, 0);
    gs.player.hp = gs.player.hpMax;
  }, frac);
  await pauseWhen("n.phase === 'field' && n._fieldAge > 200");
  await shot(name);
};
await playerAt('15-player-inside', 0.35);
// EXACTLY ON THE PAINTED EDGE. `contains` is true here and the art has to
// agree, which is the whole of §27.
await playerAt('16-player-on-the-edge', 1.0);

await resume();
await throwOne();
await pauseWhen("n.phase === 'field' && n._integrity < 0.55 && n._integrity > 0.15");
await shot('17-shutdown');

// ── §26: THE CAPTAIN MUST STILL BE THE CONTENT ─────────────────────────────
// A live Captain, his own field, ordinary enemies and the player, in one
// frame. If the eye goes to the blue circle and stays there, the field is too
// loud — and that is a question only this picture can ask.
await resume();
await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  window.__nade?.destroy?.();
  window.__nade = null;
  gs.player.setPosition(700, 1040); gs.player.setVelocity(0, 0);
  const c = gs.spawnChampion(640, 700, 'captain');
  c.die = () => { c.hp = Math.max(c.hp, 600); };
  window.__cap = c;
  gs.spawnEnemyAt?.(900, 820, 'shooter');
  gs.spawnEnemyAt?.(520, 900, 'grunt');
  await new Promise((r) => setTimeout(r, 400));
  c.armour = 40; c.damage(80, { x: 0, y: -300 });
});
await page.waitForTimeout(400);
// THE FIELD HAS TO BE LIVE IN THE PICTURE. The first run waited nine seconds
// for the real AI to choose to throw and photographed a frame with no field in
// it at all — the §26 question cannot be asked of an empty floor. The spawn
// path and the authored spec are still the real ones; only the DECISION is
// taken by the rig, which is the one thing this frame is not about.
await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { CHAMPION } = await import('/src/config.js');
  const g = CHAMPION.captain.grenade;
  gs.cameras.main.stopFollow();
  window.__nade = gs.spawnArcGrenade({ ...g, x: 640, y: 700, tx: 760, ty: 900 });
});
// Wait for the field itself, on the object's own clock.
await page.waitForFunction(() => window.__nade && window.__nade.live, null, { timeout: 12000 });
await page.waitForTimeout(500);
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs.cameras.main.centerOn(720, 820);
  gs.cameras.main.resetFX();
  gs._sectorTint?.setAlpha(0);
  window.game.scene.getScene('HUD')?.hud?.banner?.setAlpha(0);
  gs.scene.pause();
});
await page.waitForTimeout(200);
writeFileSync(`${OUT}/18-HIERARCHY-captain-field-enemies.png`, await page.screenshot());
console.log('   18-HIERARCHY-captain-field-enemies  <- the §26 frame');

await browser.close();
