// EVIDENCE — S1: THE TACTICAL STEP AND THE REACTIVE ARMOUR, AT GAMEPLAY SCALE.
//
//   node tests/shot-captain-s1.mjs [tag]
//
// §30 asks two questions a passing suite cannot answer: does the step read as
// ELITE ASSISTED FOOTWORK rather than a Harrower skateboard, and does the
// armour read as ABSORBING THE SHOT rather than as a blue sticker. Both are
// answered at 1x on a real arena floor; the x3 frames are named so they can
// never be mistaken for the review.
//
// THE STEP IS A SEQUENCE, SO IT IS PHOTOGRAPHED AS ONE. A single frame of a
// body in motion is indistinguishable from a body sliding — plant, mid-travel
// and settle next to each other is the only way to see that it is footwork.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const TAG = process.argv[2] || 's1';
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
await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 909 }));
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
  gs.player.setPosition(700, 980); gs.player.setVelocity(0, 0);
  window.__cap = gs.spawnChampion(700, 620, 'captain');
});
await page.waitForTimeout(600);

const shot = async (n) => { writeFileSync(`${OUT}/${n}.png`, await page.screenshot()); console.log('  ', n); };
const resume = () => page.evaluate(() => window.game.scene.getScene('Game').scene.resume());
const crop = async (n, w = 340, zoom = false) => {
  const at = await page.evaluate((z) => {
    const gs = window.game.scene.getScene('Game');
    const cam = gs.cameras.main;
    if (z) return { x: cam.width / 2, y: cam.y + cam.height / 2 };
    const c = window.__cap;
    return { x: c.x - cam.scrollX, y: c.y - cam.scrollY + cam.y };
  }, zoom);
  const x = Math.max(0, Math.min(720 - w, Math.round(at.x - w / 2)));
  const y = Math.max(0, Math.min(1280 - w, Math.round(at.y - w / 2)));
  writeFileSync(`${OUT}/${n}.png`, await page.screenshot({ clip: { x, y, width: w, height: w } }));
  console.log('  ', n, zoom ? '(x3, art inspection only)' : '(crop)');
};

// PAUSE ON THE FRAME THE CONDITION IS TRUE, from inside the page — a
// `page.waitForFunction` poll costs 200-400ms a round trip and the plant beat
// is 70ms, so an outside observer cannot reliably stop inside it.
const pauseWhen = async (srcExpr, timeout = 20000) => {
  await page.evaluate((code) => {
    const gs = window.game.scene.getScene('Game');
    // eslint-disable-next-line no-new-func
    const test = new Function('c', 'gs', `return (${code});`);
    const h = () => {
      const c = window.__cap;
      let ok = false;
      try { ok = !!test(c, gs); } catch (e) { ok = false; }
      if (!ok) return;
      gs.events.off('postupdate', h);
      // FRAME THE SUBJECT AT THE SHUTTER. A fixed `setScroll` is correct for a
      // matched pair and wrong here: these stations apply real knockback and a
      // real stagger, so he slides — the overload frame photographed him half
      // under the harness overlay at the top of the screen.
      gs.cameras.main.centerOn(c.x, c.y + 40);
      gs.cameras.main.resetFX();
      gs._sectorTint?.setAlpha(0);
      window.game.scene.getScene('HUD')?.hud?.banner?.setAlpha(0);
      gs.scene.pause();
    };
    gs.events.on('postupdate', h);
  }, srcExpr);
  await page.waitForFunction(
    () => window.game.scene.getScene('Game').scene.isPaused(), null, { timeout });
  await page.waitForTimeout(220);
};

const stage = `
  const gs = window.game.scene.getScene('Game');
  const c = window.__cap;
  gs.arenaActive = false;
  gs.enemies.getChildren().slice().forEach((e) => { if (e !== c) gs._destroyEnemyFully(e); });
  gs.hostileBullets.forEach((g) => g.getChildren().forEach((b) => b.active && b.kill()));
  gs.player.hp = gs.player.hpMax;
  gs.cameras.main.stopFollow();
`;

// ── A. THE STEP, AS A SEQUENCE ─────────────────────────────────────────────
// CROWD HIM AND LET HIM DECIDE. Nothing here calls `_beginStep`: the player is
// driven inside his band and the real reason solver does the rest, so what is
// photographed is what a player would cause.
await page.evaluate(new Function(`
  ${stage}
  c.setPosition(700, 620); c.setVelocity(0, 0);
  c._stepCd = 0;
  window.__drive = () => {
    const p = gs.player;
    const a = Math.atan2(c.y - p.y, c.x - p.x);
    p.setMoveInput({ x: Math.cos(a), y: Math.sin(a), force: 1 });
  };
  gs.events.on('postupdate', window.__drive);
  gs.cameras.main.setScroll(700 - gs.cameras.main.width / 2, 760 - gs.cameras.main.height / 2);
`));
await pauseWhen("c._cap === 'step' && c._stepPlantMs > 0");
await shot('01-step-plant');
await crop('01-step-plant-crop');

await resume();
// NOT THE FRAME THE PLANT ENDS. `_stepThrust` builds a Graphics whose `_tick`
// closure does the drawing, and `_tick` does not run until the NEXT
// `preUpdate` — so pausing on the frame the impulse is created photographs an
// empty object. It is the same trap that cost B.2.1 a whole reaction sheet.
// Wait until the step is partway through its travel instead.
await pauseWhen("c._cap === 'step' && c._stepPlantMs <= 0"
  + " && c._stateMs < c.def.step.travelMs * 0.7");
await shot('02-step-travel');
await crop('02-step-travel-crop');

await resume();
await pauseWhen("c._cap !== 'step' && c._stepCd > 2000");
await shot('03-step-settle');
await crop('03-step-settle-crop');

// ── B. REACTIVE ARMOUR ─────────────────────────────────────────────────────
// Each of these drives the REAL `damage()` path on intact armour and pauses
// while the absorption is still on the body. The knockback vector is the
// projectile's flight direction, which is what puts the response on the plate
// that met the shot rather than at his centre.
await resume();
await page.evaluate(new Function(`
  ${stage}
  gs.events.off('postupdate', window.__drive);
  gs.player.setMoveInput({ x: 0, y: 0, force: 0 });
  gs.player.setPosition(700, 980);
  c.setPosition(700, 620); c.setVelocity(0, 0); c._aim = Math.PI / 2;
  c.armour = c.armourMax; c.armourBroken = false;
  c.setTexture('champ-captain'); c._animPrefix = 'captain';
  c.hp = c.hpMax; c._lowHealthFired = false;
  c._cap = 'brace'; c._stateMs = 9000;
  c._stepCd = 1e9;
  gs.cameras.main.setScroll(700 - gs.cameras.main.width / 2, 760 - gs.cameras.main.height / 2);
`));
await page.waitForTimeout(400);

const absorb = async (name, code, settle) => {
  await resume();
  await page.waitForTimeout(160);
  await page.evaluate(new Function(code));
  await page.waitForTimeout(settle);
  await page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    gs.cameras.main.centerOn(window.__cap.x, window.__cap.y + 40);
    gs.cameras.main.resetFX();
    gs._sectorTint?.setAlpha(0);
    window.game.scene.getScene('HUD')?.hud?.banner?.setAlpha(0);
    gs.scene.pause();
  });
  await page.waitForTimeout(220);
  await shot(name);
  await crop(`${name}-crop`, 300);
};

// A PISTOL ROUND — the small response.
await absorb('04-absorb-light', `
  const c = window.__cap;
  c.armour = c.armourMax; c.armourBroken = false;
  c.damage(90, { x: 0, y: -300 });
`, 60);

// A SUPER PELLET FROM THE SIDE — the strong response, on a different plate.
await absorb('05-absorb-heavy', `
  const c = window.__cap;
  c.armour = c.armourMax; c.armourBroken = false;
  c.damage(600, { x: -300, y: -120 });
`, 70);

// A VOLLEY: five pellets in one frame, on five plates, capped at four.
await absorb('06-absorb-volley', `
  const c = window.__cap;
  c.armour = c.armourMax; c.armourBroken = false;
  for (let i = 0; i < 5; i++) c.damage(600, { x: -200 + i * 90, y: -260 });
`, 70);

// THE OVERLOAD: the absorption language failing, on the break frame.
await absorb('07-armour-overload', `
  const c = window.__cap;
  c.armour = 300; c.armourBroken = false;
  c.setTexture('champ-captain'); c._animPrefix = 'captain';
  c._staggerCd = 0; c._punctFreeAt = 0;
  // A modest shove: the point of this frame is the OVERLOAD, and a 300px
  // knockback throws the subject out of its own photograph.
  c.damage(2400, { x: 0, y: -60 });
`, 110);

// AND AFTER: the grammar has changed, because the layer is gone.
await absorb('08-after-break', `
  const c = window.__cap;
  c.damage(300, { x: 0, y: -300 });
`, 70);

// ── C. ART INSPECTION ONLY, AND NOT THE REVIEW ─────────────────────────────
await resume();
await page.evaluate(new Function(`
  ${stage}
  c.setPosition(700, 620); c.setVelocity(0, 0); c._aim = Math.PI / 2;
  c.armour = c.armourMax; c.armourBroken = false;
  c.setTexture('champ-captain'); c._animPrefix = 'captain';
  c.hp = c.hpMax; c._lowHealthFired = false;
  c._cap = 'brace'; c._stateMs = 9000;
  gs.cameras.main.setZoom(3);
`));
await page.waitForTimeout(200);
await page.evaluate(() => {
  const c = window.__cap;
  c.armour = c.armourMax;
  c.damage(600, { x: -300, y: -120 });
});
await page.waitForTimeout(70);
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs.cameras.main.centerOn(window.__cap.x, window.__cap.y);
  gs.cameras.main.resetFX();
  gs._sectorTint?.setAlpha(0);
  window.game.scene.getScene('HUD')?.hud?.banner?.setAlpha(0);
  gs.scene.pause();
});
await page.waitForTimeout(240);
await crop('09-INSPECTION-x3-absorb', 420, true);
await page.evaluate(() => window.game.scene.getScene('Game').cameras.main.setZoom(1));

const state = await page.evaluate(() => {
  const c = window.__cap;
  return { armour: Math.round(c.armour), armourMax: c.armourMax,
    hp: Math.round(c.hp), hpMax: c.hpMax, total: c.armourMax + c.hpMax,
    broken: c.armourBroken, reactFx: c._reactFx.length };
});
console.log('  final:', JSON.stringify(state));
await browser.close();
