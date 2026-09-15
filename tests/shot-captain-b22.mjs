// EVIDENCE — SHOCK CAPTAIN PHASE B.2.2, AT GAMEPLAY SCALE.
//
//   node tests/shot-captain-b22.mjs [tag]
//
// THE ENLARGED SHEET IS NOT THE REVIEW. 1x on a real arena floor under the real
// HUD inset is the acceptance authority (`HANDOVER.md` §10af); every frame here
// is the live game at 720x1280 with nothing scaled. Crops are the SAME PIXELS
// cut to the square the event happens in, because judging a six-pixel scorch by
// squinting at a full portrait screenshot is how a sustained state gets
// approved while being invisible.
//
// TWO SHUTTER RULES THIS RIG OBEYS, BOTH LEARNED THE HARD WAY:
//   - FREEZING THE TWEEN CLOCK DESTROYS ANYTHING THAT TWEENS IN. A muzzle flash
//     is drawn at full alpha and tweened OUT, so stopping time preserves it. A
//     glyph is created at alpha 0 and tweened IN, and a discharge draws nothing
//     until its first `preUpdate` — freeze first and you photograph an
//     invisible glyph over an empty Graphics. So: run, let the beat land, then
//     `scene.pause()`, which stops the tween manager with everything else.
//   - AN EVENT-DRIVEN EFFECT MUST BE HELD OPEN, NOT INVOKED. The short circuit
//     is 130ms on a re-rolled interval; the station sets `_arcHold` — the same
//     field the real clock sets — and lets ONE frame draw it.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const TAG = process.argv[2] || 'b22';
const OUT = `docs/evidence/champion-reset/${TAG}`;
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
const errs = [];
page.on('pageerror', (e) => { errs.push(String(e)); console.error('PAGE ERROR', e); });

await page.goto('http://localhost:5173/?nodlg=1&nofreeze=1');
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
});
await page.waitForTimeout(4200);

const shot = async (n) => { writeFileSync(`${OUT}/${n}.png`, await page.screenshot()); console.log('  ', n); };
const crop = async (n, w = 300, h = 300, onPlayer = false) => {
  const at = await page.evaluate((p) => {
    const gs = window.game.scene.getScene('Game');
    const t = p ? gs.player : window.__cap;
    if (!t?.scene) return null;
    const cam = gs.cameras.main;
    return { x: t.x - cam.scrollX, y: t.y - cam.scrollY + cam.y };
  }, onPlayer);
  if (!at) return;
  const x = Math.max(0, Math.min(720 - w, Math.round(at.x - w / 2)));
  const y = Math.max(0, Math.min(1280 - h, Math.round(at.y - h / 2)));
  writeFileSync(`${OUT}/${n}.png`, await page.screenshot({ clip: { x, y, width: w, height: h } }));
  console.log('  ', n, '(crop)');
};
const resume = () => page.evaluate(() => window.game.scene.getScene('Game').scene.resume());

/**
 * PAUSE ON THE FRAME THE CONDITION IS TRUE, FROM INSIDE THE PAGE.
 *
 * `page.waitForFunction` polls from OUTSIDE and each round trip costs
 * 200-400ms, so it cannot reliably stop inside a 400ms window — an earlier
 * build of this rig asked it to catch a grenade between 220ms and 620ms of a
 * flight and simply sat there. This installs a `postupdate` hook that tests the
 * condition on the game's own frame and pauses the scene itself, then waits for
 * `isPaused`, which is a state rather than a window and cannot be missed.
 */
const pauseWhen = async (src, timeout = 20000) => {
  await page.evaluate((code) => {
    const gs = window.game.scene.getScene('Game');
    // eslint-disable-next-line no-new-func
    const test = new Function('c', 'n', 'gs', `return (${code});`);
    const h = () => {
      const c = window.__cap;
      const n = c?._nade;
      let ok = false;
      try { ok = !!test(c, n, gs); } catch (e) { ok = false; }
      if (!ok) return;
      gs.events.off('postupdate', h);
      gs.cameras.main.resetFX();
      gs._sectorTint?.setAlpha(0);
      window.game.scene.getScene('HUD')?.hud?.banner?.setAlpha(0);
      gs.scene.pause();
    };
    gs.events.on('postupdate', h);
  }, src);
  await page.waitForFunction(
    () => window.game.scene.getScene('Game').scene.isPaused(), null, { timeout });
  await page.waitForTimeout(220);
};
const hushPause = () => page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  // A PAUSED SCENE FREEZES A CAMERA FLASH FOREVER, and the flash lives on the
  // camera so walking the display list for it finds nothing.
  gs.cameras.main.resetFX();
  gs._sectorTint?.setAlpha(0);
  window.game.scene.getScene('HUD')?.hud?.banner?.setAlpha(0);
  gs.scene.pause();
});

await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs.arenaActive = false;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  gs.player.setPosition(700, 980); gs.player.setVelocity(0, 0);
  window.__cap = gs.spawnChampion(700, 620, 'captain');
});
await page.waitForTimeout(400);

const stage = `
  const gs = window.game.scene.getScene('Game');
  const c = window.__cap;
  gs.arenaActive = false;
  gs.enemies.getChildren().slice().forEach((e) => { if (e !== c) gs._destroyEnemyFully(e); });
  gs.hostileBullets.forEach((g) => g.getChildren().forEach((b) => b.active && b.kill()));
  gs.player.setPosition(700, 980); gs.player.hp = gs.player.hpMax;
  c.setPosition(700, 620); c.setVelocity(0, 0);
  c._aim = Math.PI / 2;
  gs.cameras.main.stopFollow?.();
  gs.cameras.main.setScroll(700 - gs.cameras.main.width / 2, 800 - gs.cameras.main.height / 2);
`;

// ── A. THE DETERIORATION LADDER ───────────────────────────────────────────
const beat = async (name, fire, settleMs = 170, cropW = 300) => {
  await resume();
  await page.waitForTimeout(220);
  await page.evaluate(fire);
  if (settleMs) await page.waitForTimeout(settleMs);
  await hushPause();
  await page.waitForTimeout(220);
  await shot(name);
  await crop(`${name}-crop`, cropW, cropW);
};

await beat('01-healthy', new Function(`
  ${stage}
  c.armour = c.armourMax; c.armourBroken = false; c._lowHealthFired = false;
  c.hp = c.hpMax;
  c.setTexture('champ-captain'); c._animPrefix = 'captain';
  c._cap = 'brace'; c._stateMs = 4000;
`), 300);

// THE BREAK, through the real path, with overkill so the SPILL runs — the break
// a Super causes, not a special case sized to look good.
await beat('02-armour-break', new Function(`
  ${stage}
  c.armour = c.armourMax; c.armourBroken = false;
  c.setTexture('champ-captain'); c._animPrefix = 'captain';
  c._staggerCd = 0; c._punctFreeAt = 0;
  c.damage(c.armour / c.def.armourTake + 900, { x: 0, y: -160 });
`), 150);

await beat('03-damaged-body', new Function(`
  ${stage}
  c._cap = 'brace'; c._stateMs = 4000;
  c._wearSmokeT = 0;
`), 900);

// THE SHORT CIRCUIT, HELD OPEN. `_arcHold` is the same field the real clock
// writes; setting it and letting ONE frame draw is the honest way to photograph
// a 130ms event in a harness that renders every ~70ms.
await beat('04-damaged-short', new Function(`
  ${stage}
  c._cap = 'brace'; c._stateMs = 4000;
  c._arcHold = c.def.arc.holdMs; c._arcToRifle = false;
`), 90);

await beat('05-critical', new Function(`
  ${stage}
  c._cap = 'brace'; c._stateMs = 4000;
  c.hp = c.hpMax * 0.18; c._lowHealthFired = true;
  c._wearSmokeT = 0;
`), 900);

await beat('06-critical-short-to-rifle', new Function(`
  ${stage}
  c._cap = 'brace'; c._stateMs = 4000;
  c._arcHold = c.def.arc.holdMs; c._arcToRifle = true;
`), 90);

await beat('07-critical-visor-flicker', new Function(`
  ${stage}
  c._cap = 'brace'; c._stateMs = 4000;
  c._flickerHold = c.def.wearFlickerHoldMs;
`), 60);

// AND IN A CROWD, which is the only place the restraint can be judged: a
// damaged Captain has to stay identifiable with six other bodies and their
// fire over the same square metre.
await beat('08-critical-in-crowd', new Function(`
  ${stage}
  gs.player.setPosition(620, 1000);
  c._cap = 'recover'; c._stateMs = 10;
  c._arcHold = c.def.arc.holdMs;
  [[420,560],[560,480],[880,520],[980,680],[520,760],[900,820]].forEach(([x,y],i) => {
    const e = gs.spawnEnemyAt(i % 2 ? 'shooter' : 'grunt', x, y);
    if (e) { e.fireCd = 1e9; e.state = 1; }
  });
`), 140, 420);

// ── B. THE ARC GRENADE, BEAT BY BEAT ──────────────────────────────────────
// Nothing below invokes the throw. `_nadeCd = 0` is the whole of the staging;
// the decision, the range gate, the LOS gate, the wind-up and the lead are the
// Captain's, so what is photographed is what a player would be shown.
await resume();
await page.evaluate(new Function(`
  ${stage}
  gs.enemies.getChildren().slice().forEach((e) => { if (e !== c) gs._destroyEnemyFully(e); });
  c.hp = c.hpMax; c._lowHealthFired = false;
  c.armour = c.armourMax; c.armourBroken = false;
  c.setTexture('champ-captain'); c._animPrefix = 'captain';
  c._cap = 'strafe'; c._stateMs = 200;
  c._nadeCd = 0; c._nade = null;
  // The player walks, so the lead has something to read.
  window.__drive = () => gs.player.setMoveInput({ x: 1, y: 0, force: 1 });
  gs.events.on('postupdate', window.__drive);
`));
await pauseWhen("c && c._cap === 'windup'");
await shot('09-grenade-windup');
await crop('09-grenade-windup-crop');

await resume();
await pauseWhen("n && n.phase === 'flight' && n.age > 200");
await shot('10-grenade-in-flight');

await resume();
await pauseWhen("n && n.phase === 'arm' && n.age > n.flightMs + 240");
await shot('11-grenade-arming');

await resume();
await pauseWhen("n && n.phase === 'field' && n._fieldAge > 240");
await shot('12-arc-field-live');
await crop('12-arc-field-live-crop', 460, 460);

// THE LOOP: the field is live and he is working around it. This is the frame
// that has to show "one fighter using two tools" rather than "an enemy that
// threw something".
await resume();
await pauseWhen("n && n.phase === 'field' && n._fieldAge > 900");
await shot('13-field-and-captain');

// THE EXPIRY. The last `warnMs` visibly fails, so the player can spend it — an
// effect that simply stops has told them nothing.
await resume();
await pauseWhen("n && !n.dead && n.phase === 'field' && n._integrity < 0.7");
await shot('14-arc-field-failing');

// ── C. THE BURST, AIMED AT A MOVING PLAYER ────────────────────────────────
// All three rounds in the air at once is the only frame that can show ESTABLISH
// / LEAD / BRACKET as three different answers. The gaps are 165ms, so the
// shutter goes after the third round leaves and before the first expires.
await resume();
await page.evaluate(new Function(`
  ${stage}
  gs.events.off('postupdate', window.__drive);
  c._nade?.destroy?.(); c._nade = null; c._nadeCd = 1e9;
  gs.player.setPosition(700, 1000);
  c.setPosition(700, 560);
  c._cap = 'brace'; c._stateMs = 60; c._fireCd = 0;
  window.__drive2 = () => gs.player.setMoveInput({ x: 1, y: 0, force: 1 });
  gs.events.on('postupdate', window.__drive2);
  gs.cameras.main.setScroll(760 - gs.cameras.main.width / 2, 800 - gs.cameras.main.height / 2);
`));
await pauseWhen("gs.captainBullets.getChildren().filter((b) => b.active).length >= 3");
await shot('15-burst-three-leads');

// ── D. ART INSPECTION ONLY, AND IT IS NOT THE REVIEW ──────────────────────
// `HANDOVER.md` §10af: 1x on a real arena floor is the acceptance authority,
// and an effect approved off a zoomed frame is an effect nobody has seen. Every
// image above is 1x. These three are x3, for reading the SHAPE of the scorch
// and the arcs while authoring them, and they are named so they can never be
// mistaken for evidence that those shapes read in play.
//
// A ZOOMED CAMERA DOES NOT TRANSFORM LIKE AN UNZOOMED ONE. `scrollX` is the
// top-left in UNZOOMED world units, so `(x - scrollX) * zoom` lands off the
// viewport entirely — measured at (1080, 1878) on a 720x1280 page, which is how
// the first build of this station photographed empty deck. After `centerOn` the
// subject IS the viewport centre by construction, and the viewport is inset by
// the HUD's top bar.
const inspect = async (name, setup, settleMs) => {
  await resume();
  await page.waitForTimeout(200);
  await page.evaluate(new Function(`
    ${stage}
    gs.cameras.main.setZoom(3);
    ${setup}
  `));
  await page.waitForTimeout(settleMs);
  await page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    gs.cameras.main.centerOn(window.__cap.x, window.__cap.y);
    gs.cameras.main.resetFX();
    gs._sectorTint?.setAlpha(0);
    window.game.scene.getScene('HUD')?.hud?.banner?.setAlpha(0);
    gs.scene.pause();
  });
  await page.waitForTimeout(240);
  const at = await page.evaluate(() => {
    const cam = window.game.scene.getScene('Game').cameras.main;
    return { x: cam.width / 2, y: cam.y + cam.height / 2 };
  });
  const S = 420;
  const x = Math.max(0, Math.min(720 - S, Math.round(at.x - S / 2)));
  const y = Math.max(0, Math.min(1280 - S, Math.round(at.y - S / 2)));
  writeFileSync(`${OUT}/${name}.png`, await page.screenshot({ clip: { x, y, width: S, height: S } }));
  console.log('  ', name, '(x3, art inspection only)');
};

await resume();
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs.events.off('postupdate', window.__drive2);
  gs.player.setMoveInput({ x: 0, y: 0, force: 0 });
  gs.captainBullets.getChildren().forEach((b) => b.active && b.kill());
});

await inspect('16-INSPECTION-x3-damaged', `
  c.armour = 0; c.armourBroken = true; c._animPrefix = 'captainbrk';
  c.setTexture('champ-captain-broken');
  c.hp = c.hpMax * 0.6; c._lowHealthFired = false;
  c._cap = 'brace'; c._stateMs = 4000; c._wearSmokeT = 0;
`, 700);

await inspect('17-INSPECTION-x3-damaged-short', `
  c._cap = 'brace'; c._stateMs = 4000;
  c._arcHold = c.def.arc.holdMs; c._arcToRifle = false;
`, 60);

await inspect('18-INSPECTION-x3-critical-short', `
  c.hp = c.hpMax * 0.18; c._lowHealthFired = true;
  c._cap = 'brace'; c._stateMs = 4000;
  c._arcHold = c.def.arc.holdMs; c._arcToRifle = true;
`, 60);
await page.evaluate(() => window.game.scene.getScene('Game').cameras.main.setZoom(1));

const state = await page.evaluate(() => {
  const c = window.__cap;
  const gs = window.game.scene.getScene('Game');
  if (!c?.scene) return { note: 'subject retired' };
  return {
    hp: Math.round(c.hp), hpMax: c.hpMax, armour: Math.round(c.armour),
    broken: c.armourBroken, critical: c._lowHealthFired,
    tex: c.texture.key, anim: c.anims.currentAnim?.key,
    liveHazards: gs._hazards.filter((h) => !h.dead).length,
    reactFx: c._reactFx.length,
  };
});
console.log('  final:', JSON.stringify(state));
if (errs.length) console.log('  PAGE ERRORS:', errs.slice(0, 4));
await browser.close();
