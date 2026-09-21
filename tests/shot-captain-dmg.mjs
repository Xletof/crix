// EVIDENCE — THE DIRECTIONAL DAMAGED MODEL, AT GAMEPLAY SCALE.
//
//   node tests/shot-captain-dmg.mjs [tag]
//
// §16 is the acceptance list and it is a MATRIX, not a screenshot: three
// authored body states across four facings, because the whole claim of this
// pass is that the damage belongs to the body and therefore TURNS WITH IT. A
// single front-facing still cannot fail the thing that was actually wrong.
//
// The x3 frames are art inspection only and are named so.
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
  gs.player.setPosition(700, 1050); gs.player.setVelocity(0, 0);
  const c = gs.spawnChampion(700, 620, 'captain');
  // AN IMMORTALITY STUB, BECAUSE THIS RIG DRIVES REAL DAMAGE. Without it the
  // critical step killed him and every frame after state 1 was taken of a
  // corpse — or of nothing, which is how it presented. `delete`d nowhere here
  // because nothing in this rig needs a real death.
  c.die = () => { c.hp = Math.max(c.hp, 600); };
  window.__cap = c;
});
await page.waitForTimeout(600);

const crop = async (n, w = 260, zoom = 1) => {
  const at = await page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    const cam = gs.cameras.main;
    const c = window.__cap;
    return { x: c.x - cam.scrollX, y: c.y - cam.scrollY + cam.y };
  });
  const x = Math.max(0, Math.min(720 - w, Math.round(at.x - w / 2)));
  const y = Math.max(0, Math.min(1280 - w, Math.round(at.y - w / 2)));
  writeFileSync(`${OUT}/${n}.png`, await page.screenshot({ clip: { x, y, width: w, height: w } }));
  console.log('  ', n, zoom > 1 ? '(x3, art inspection only)' : '');
};

// THE STATES ARE DRIVEN THROUGH THE REAL TRANSITIONS, not by writing a texture
// name: what is photographed is what a player would cause. `_setBodyState` is
// never called by this rig.
const setState = (lvl) => page.evaluate((l) => {
  const gs = window.game.scene.getScene('Game');
  const c = window.__cap;
  c.armour = c.armourMax; c.armourBroken = false; c._lowHealthFired = false;
  c.hp = c.hpMax;
  c._animPrefix = c.def.anim; c.setTexture(c.def.tex);
  c._arcHold = 0;
  // SMALL, REAL HITS THAT CROSS THE REAL LINES. A large one is multiplied by
  // `_punishMult` on the way in and by `armourSpill` on the way through, which
  // is how the first version of this rig deleted its own subject.
  if (l >= 1) { c.armour = 40; c.damage(80, { x: 0, y: -300 }); }
  if (l >= 2) {
    c.hp = c.hpMax * c.def.lowHealthFrac + 80;
    c.damage(90, { x: 0, y: -300 });
  }
  gs.cameras.main.stopFollow();
  gs.cameras.main.setScroll(c.x - gs.cameras.main.width / 2, c.y - gs.cameras.main.height / 2);
}, lvl);

// PIN HIM, AND RE-PARK THE CAMERA AT EVERY SHUTTER. The scene has to RESUME
// between stations for the real transitions to run, and a Captain with a live
// state machine walks — the first run of this rig photographed him leaving the
// left edge of eight of its own crops. A camera parked once at the top of a
// state is a camera pointing where he used to be.
const face = (deg) => page.evaluate((d) => {
  const gs = window.game.scene.getScene('Game');
  const c = window.__cap;
  c.setPosition(700, 620);
  c.setVelocity(0, 0);
  c._stepCd = 1e9;
  c._nadeCd = 1e9;
  c._aim = d * Math.PI / 180;
  c._cap = 'strafe';
  c._applyAnim();
  const a = window.game.anims.get(c.anims.currentAnim.key);
  if (a) c.setFrame(a.frames[0].frame.name);
  // The weapon overlay is placed by `Enemy.preUpdate`; nudge it to the new aim
  // so the still is not photographed with last frame's rifle.
  const w = c.weaponSprite;
  if (w) { w.setFlipY(Math.abs(c._aim) > Math.PI / 2); w.rotation = c._aim; }
  gs.cameras.main.stopFollow();
  gs.cameras.main.setScroll(c.x - gs.cameras.main.width / 2,
    c.y - gs.cameras.main.height / 2);
}, deg);

const shutter = () => page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs.cameras.main.resetFX();
  gs._sectorTint?.setAlpha(0);
  window.game.scene.getScene('HUD')?.hud?.banner?.setAlpha(0);
  gs.scene.pause();
});
const resume = () => page.evaluate(() => window.game.scene.getScene('Game').scene.resume());

const FACES = [['front', 90], ['back', -90], ['east', 0], ['west', 180]];
const STATES = [['0-intact', 0], ['1-broken', 1], ['2-critical', 2]];

for (const [sName, lvl] of STATES) {
  await resume();
  await setState(lvl);
  await page.waitForTimeout(260);
  for (const [fName, deg] of FACES) {
    await resume();
    await face(deg);
    await page.waitForTimeout(140);
    await shutter();
    await page.waitForTimeout(160);
    await crop(`${sName}-${fName}`);
  }
}

// AND THROUGH MOTION. §7: the damage has to survive the animation families the
// approved work lives in, not just one frozen pose.
await resume();
await setState(1);
await page.waitForTimeout(200);
for (const [n, cap, key] of [['walk', 'advance', 'walk'], ['strafe', 'strafe', 'strafe'],
  ['fire', 'burst', 'fire'], ['brace', 'brace', 'brace']]) {
  await resume();
  await page.evaluate(({ c: capState, k }) => {
    const gs = window.game.scene.getScene('Game');
    const c = window.__cap;
    c.setPosition(700, 620); c.setVelocity(0, 0);
    c._aim = Math.PI / 2;
    c._cap = capState;
    gs.cameras.main.stopFollow();
    gs.cameras.main.setScroll(c.x - gs.cameras.main.width / 2,
      c.y - gs.cameras.main.height / 2);
    const key2 = `${c._animPrefix}-${k}-front`;
    if (c.scene.anims.exists(key2)) {
      c.play(key2, true);
      const a = window.game.anims.get(key2);
      c.setFrame(a.frames[Math.min(2, a.frames.length - 1)].frame.name);
    }
  }, { c: cap, k: key });
  await page.waitForTimeout(140);
  await shutter();
  await page.waitForTimeout(160);
  await crop(`3-broken-${n}`);
}

// CRITICAL, MID-BURST, WITH THE FAILURE LIVE — the frame a player actually
// sees, rather than a mannequin.
await resume();
await setState(2);
await page.waitForTimeout(200);
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  const c = window.__cap;
  c.setPosition(700, 620); c.setVelocity(0, 0);
  c._aim = Math.PI / 2;
  c._cap = 'burst';
  c._arcHold = c.def.arc.holdMs;
  gs.cameras.main.stopFollow();
  gs.cameras.main.setScroll(c.x - gs.cameras.main.width / 2,
    c.y - gs.cameras.main.height / 2);
  c._drawDamage();
  const k = `${c._animPrefix}-fire-front`;
  if (c.scene.anims.exists(k)) c.play(k, true);
});
await page.waitForTimeout(120);
await shutter();
await page.waitForTimeout(160);
await crop('4-critical-firing-short');

// x3 — ART INSPECTION ONLY.
for (const [sName, lvl] of STATES) {
  await resume();
  await setState(lvl);
  await page.evaluate(() => { window.__cap.setScale(3); });
  await page.waitForTimeout(200);
  await face(90);
  await page.waitForTimeout(140);
  await shutter();
  await page.waitForTimeout(160);
  await crop(`5-INSPECTION-x3-${sName}`, 420, 3);
  await resume();
  await page.evaluate(() => { window.__cap.setScale(window.__cap._baseScale || 1); });
}

// ── THE CONTACT SHEET — THE ONLY FRAME THAT ANSWERS §16 ────────────────────
// "Can I tell intact from broken from critical at 1x" is a COMPARISON, and a
// human cannot make it by flipping between three files. Twelve crops on one
// canvas, rows by state and columns by facing, drawn in the page so it needs
// no image library on the box.
const sheet = await page.evaluate(async (names) => {
  const CELL = 200, COLS = 4;
  const load = (n) => new Promise((res) => {
    const i = new Image();
    i.onload = () => res(i);
    i.src = `/docs/evidence/champion-reset/vf/${n}.png`;
  });
  const imgs = await Promise.all(names.map(load));
  const cv = document.createElement('canvas');
  cv.width = CELL * COLS; cv.height = CELL * 3 + 26;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#0b0c10'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.imageSmoothingEnabled = false;
  imgs.forEach((im, i) => {
    const cxx = (i % COLS) * CELL, cyy = Math.floor(i / COLS) * CELL + 26;
    ctx.drawImage(im, 0, 0, im.width, im.height, cxx, cyy, CELL, CELL);
    ctx.strokeStyle = '#2a2d35'; ctx.strokeRect(cxx + 0.5, cyy + 0.5, CELL - 1, CELL - 1);
  });
  ctx.fillStyle = '#e6e0d0'; ctx.font = 'bold 15px monospace';
  ['FRONT', 'BACK', 'EAST', 'WEST'].forEach((t, i) => ctx.fillText(t, i * CELL + 8, 18));
  ctx.save(); ctx.font = 'bold 13px monospace';
  ['INTACT', 'BROKEN', 'CRITICAL'].forEach((t, r) => {
    ctx.fillStyle = 'rgba(11,12,16,0.85)';
    ctx.fillRect(2, r * CELL + 28, 78, 17);
    ctx.fillStyle = '#e6e0d0';
    ctx.fillText(t, 6, r * CELL + 41);
  });
  ctx.restore();
  return cv.toDataURL('image/png').split(',')[1];
}, ['0-intact-front', '0-intact-back', '0-intact-east', '0-intact-west',
  '1-broken-front', '1-broken-back', '1-broken-east', '1-broken-west',
  '2-critical-front', '2-critical-back', '2-critical-east', '2-critical-west']);
writeFileSync(`${OUT}/00-MATRIX-state-x-facing.png`, Buffer.from(sheet, 'base64'));
console.log('   00-MATRIX-state-x-facing  <- the acceptance frame');

await browser.close();


