// DIAGNOSTIC (prints numbers, asserts nothing): WEAPON < SHIELD, measured the
// same way on ANY build of the field — so it A/Bs against a build whose
// renderer has no cell records at all.
//
// Per facing (16) and tier (2), three photographs of one bearer:
//   1. the gun (and, on the shot frame, its discharge) tint-filled magenta,
//      field on;
//   2. gun hidden, field on;
//   3. gun hidden, field off.
// The FIELD MASK is every pixel where 2 and 3 differ. A LEAK is a pixel in
// the mask that is still pure magenta in 1: the gun drawn on top of the field.
//
// usage: node tests/diag-bulwark-layering.mjs [--base=URL] [--shot]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const BASE = opt('base', 'http://localhost:5173/');
const SHOT = process.argv.includes('--shot');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
page.on('pageerror', (e) => { console.error(e.message); process.exit(1); });
await page.goto(`${BASE}?nodlg=1&nofreeze=1&roster=v1&gait=v2`);
await page.waitForFunction(() => window.game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 45000 });
await page.evaluate(() => {
  const g = window.game; g.loop.sleep();
  let s = 12345; Math.random = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  window.__t = 1e5; Date.now = () => window.__t;
  window.__adv = (n = 1) => { for (let i = 0; i < n; i++) { window.__t += 1000 / 60; g.step(window.__t, 1000 / 60); } };
  g.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 4242 }); window.__adv(2);
  const gs = (window.__gs = g.scene.getScene('Game'));
  for (let i = 0; i < 300 && !gs.roomSpec; i++) window.__adv(1);
  window.__adv(20);
  gs.arenaActive = false; gs._roomModifier = null;
  for (const e of gs.enemies.getChildren().slice()) gs._destroyEnemyFully(e);
  for (const o of gs.roomLayer.getChildren()) if (o.body && (o.displayWidth || 0) < 1000) o.body.enable = false;
  gs.cameraDirector.update = () => {};
  g.scene.getScene('HUD')?.scene.setVisible(false);
  const P = gs.player; P.setPosition(820, 1300); P.body.reset(P.x, P.y); P.setVisible(false); P.weaponSprite?.setVisible(false);
  // the field only: not the projector core (painted on the gauntlet, under the gun by design)
  window.__fieldGfx = (f) => [f.near, f.far, f.farW, f.glowNear, f.glowFar, f.glowFarW].filter(Boolean);
  window.__stage = (elite, k, shot) => {
    for (const e of gs.enemies.getChildren().slice()) gs._destroyEnemyFully(e);
    const e = (window.__e = gs.spawnEnemyAt('shielded', 820, 700, elite ? { elite: true } : {}));
    e._performing = true; e._movePlanted = true;
    const fac = -Math.PI + k * Math.PI / 8 + 0.004;
    e._aim = fac; e._shieldFacing = fac;
    gs.cameras.main.setScroll(820 - 360, 700 - 400);
    window.__adv(3);
    if (shot) { gs.events.emit('shooter-fire', e); for (const o of gs.children.list) if (o.texture?.key === 'fx-blw-muzzle' && o.visible) o.setTintFill(0xff00ff); }
    e.weaponSprite.setTintFill(0xff00ff);
    gs.cameras.main.resetFX(); gs._sectorTint?.setAlpha(0);
    window.__adv(1);
    const wv = gs.cameras.main.worldView, cam = gs.cameras.main;
    return { x: Math.round(820 - 110 - wv.x + cam.x), y: Math.round(700 - 110 - wv.y + cam.y) };
  };
});
// the same frame re-rendered with things hidden: no update, no clock —
// game.step would advance the field, so render through the scene manager
await page.evaluate(() => {
  const g = window.game, gs = window.__gs;
  window.__render = (gun, field) => {
    const e = window.__e;
    e.weaponSprite.setVisible(gun);
    for (const o of gs.children.list) if (o.texture?.key === 'fx-blw-muzzle' && o.active) o.setVisible(gun);
    for (const gg of window.__fieldGfx(e._curtain)) gg.setVisible(field);
    g.renderer.preRender(); g.scene.render(g.renderer); g.renderer.postRender();
  };
});
const dec = await browser.newPage();
const decode = (buf) => dec.evaluate(async (src) => {
  const i = new Image(); i.src = src; await i.decode();
  const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d'); x.drawImage(i, 0, 0);
  return Array.from(x.getImageData(0, 0, c.width, c.height).data);
}, `data:image/png;base64,${buf.toString('base64')}`);
const isMag = (d, o) => d[o] >= 250 && d[o + 1] <= 12 && d[o + 2] >= 250;
const rows = [];
for (const elite of [false, true]) {
  for (let k = 0; k < 16; k++) {
    const pos = await page.evaluate(([elite, k, shot]) => window.__stage(elite, k, shot), [elite, k, SHOT]);
    const clip = { x: pos.x, y: pos.y, width: 220, height: 220 };
    await page.evaluate(() => window.__render(true, true)); const a = await decode(await page.screenshot({ clip }));
    await page.evaluate(() => window.__render(false, true)); const b = await decode(await page.screenshot({ clip }));
    await page.evaluate(() => window.__render(false, false)); const c = await decode(await page.screenshot({ clip }));
    let mask = 0, gun = 0, leak = 0;
    for (let o = 0; o < a.length; o += 4) {
      const inField = Math.abs(b[o] - c[o]) + Math.abs(b[o + 1] - c[o + 1]) + Math.abs(b[o + 2] - c[o + 2]) > 6;
      if (inField) mask++;
      if (isMag(a, o)) { gun++; if (inField) leak++; }
    }
    rows.push({ elite, k, deg: Math.round(-180 + k * 22.5), mask, gun, leak });
  }
}
const tot = rows.reduce((p, r) => p + r.leak, 0);
console.log(`${BASE} ${SHOT ? '(shot frame: gun + discharge)' : '(idle)'} — gun pixels drawn ON TOP of the field, per facing (deg: leak px)`);
for (const elite of [false, true]) console.log(`  ${elite ? 'ELITE  ' : 'REGULAR'} ${rows.filter((r) => r.elite === elite).map((r) => `${r.deg}:${r.leak}`).join('  ')}`);
console.log(`  total ${tot} leaking px over ${rows.filter((r) => r.leak).length}/${rows.length} frames (${rows.reduce((p, r) => p + r.gun, 0)} gun px on screen)`);
await browser.close();
