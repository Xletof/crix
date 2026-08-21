// DIAGNOSTIC — LIGHTS OUT and DISARM, measured as the player experiences them.
//
// Not a smoke test. It asserts nothing and changes nothing. It answers two
// questions the existing suite cannot ask, because the existing suite checks
// that a boolean flipped and a pickup exists:
//
//   LIGHTS OUT  how much darker does the SCREEN actually get, where, measured
//               off real screenshots and off the vignette's own alpha profile
//   DISARM      which player verbs still work while "DISARMED" is on screen
//
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';

const URL = 'http://localhost:5173/?nodlg=1&nofreeze=1';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const OUT = 'docs/evidence/mech-truth';

const browser = await chromium.launch({ executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
page.on('pageerror', (e) => console.error('PAGE ERROR', e));

await page.goto(URL);
await page.waitForTimeout(4500);
await page.mouse.click(360, 640);
await page.waitForTimeout(800);
await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 777 }));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(1500);

// Encounter 6 — the rung that carries both mechanics and ECLIPSE.
await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { ROOMS } = await import('/src/data/rooms.js');
  const { ENDLESS } = await import('/src/config.js');
  gs.sector = 6 * ENDLESS.bossEvery;
  gs.loadRoom(ROOMS.find((r) => r.boss));
  await new Promise((r) => setTimeout(r, 2200));
  gs.arenaActive = false;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  if (!gs.boss?.alive) { gs.spawnBoss(gs.player.x + 380, gs.player.y); await new Promise((r) => setTimeout(r, 700)); }
  gs.player.hp = gs.player.hpMax; gs.lives = 9999;
  // Silence every free-running clock so nothing else fires mid-measurement.
  const b = gs.boss, FAR = 1e9;
  b._blackoutT = FAR; b._afterimageT = FAR; b._disarmT = FAR; b._sunderT = FAR; b._reflectT = FAR;
  b.cooldown = 1e9; b._moveT = 1e9;
});
await page.waitForTimeout(600);

const R = { };

// ── the vignette's own alpha profile, read off the texture that draws it ─────
R.profile = await page.evaluate(() => {
  const hud = window.game.scene.getScene('HUD');
  hud.setDarkness(true);                       // force the overlay into existence
  const tex = window.game.textures.get('darknessVignette');
  const ctx = tex.getSourceImage().getContext('2d');
  const w = tex.getSourceImage().width, h = tex.getSourceImage().height;
  const cx = w / 2, cy = h / 2;
  const at = (r) => {
    const d = ctx.getImageData(Math.round(cx + r), Math.round(cy), 1, 1).data;
    return { r, a: +(d[3] / 255).toFixed(3) };
  };
  return {
    size: [w, h],
    // sampled along the horizontal from screen centre outward
    samples: [0, 60, 120, 158, 200, 260, 320, 360, 440, 520, 600, 680, 734].map(at),
    // the four screen extremes
    edgeMidX: at(360).a, cornerR: Math.round(Math.hypot(w / 2, h / 2)),
  };
});

// ── screenshots: before / during / after, off the real production path ───────
await page.evaluate(() => window.game.scene.getScene('HUD').setDarkness(false));
await page.waitForTimeout(700);
// Screenshots only — luminance is measured in diag-lights-ab.mjs, on a frozen
// frame, because before/after shots of a live fight photograph different rooms.
const shot = async (name) => { writeFileSync(`${OUT}/${name}.png`, await page.screenshot()); return name; };
R.before = await shot('lights-1-before');

// production path, long hold so the plateau is stable to photograph
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs.events.emit('boss-blackout', gs.boss, 6000);
});
const alphaAt = () => page.evaluate(() => {
  const ov = window.game.scene.getScene('HUD').darknessOverlay;
  return ov ? { alpha: +ov.alpha.toFixed(3), visible: ov.visible, depth: ov.depth,
                sf: ov.scrollFactorX, x: ov.x, y: ov.y, w: ov.displayWidth, h: ov.displayHeight } : null;
});
R.tape = [];
for (const t of [100, 150, 250, 500]) { await page.waitForTimeout(t === 100 ? 100 : t - R.tape.at(-1).t);
  R.tape.push({ t, ...(await alphaAt()) }); }
await page.waitForTimeout(500);
R.tape.push({ t: 1000, ...(await alphaAt()) });
R.during = await shot('lights-2-during');
await page.waitForTimeout(1500);
R.mid = await alphaAt();
await page.waitForTimeout(4000);   // past the 6000ms hold + 420ms fade
R.after = await shot('lights-3-after');
R.afterAlpha = await alphaAt();

// ── DISARM: what still works while DISARMED is on screen ────────────────────
R.disarm = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const p = gs.player;
  const { PLAYER } = await import('/src/config.js');
  const nBullets  = () => gs.playerBullets.getChildren().filter((b) => b.active).length;
  const nFrags    = () => (gs.clusterFrags?.getChildren() || []).filter((b) => b.active).length;
  const probe = (label) => {
    const b0 = nBullets(), f0 = nFrags();
    p.fireCooldown = 0; p.ammo = PLAYER.ammoMax; p._burstLeft = 0;
    p.dashCd = 0; p.superCharge = PLAYER.superHitsToCharge; p.meleeCharge = 999;
    const out = { label, secondary: p.secondary, secondaryAmmo: p.secondaryAmmo,
                  weaponTex: p.weaponSprite?.texture?.key ?? null };
    out.primaryFire = p.tryFire(0);
    out.bulletsSpawned = nBullets() - b0;
    out.fragsSpawned = nFrags() - f0;
    p.fireCooldown = 0;
    out.dash  = p.tryDash();
    out.melee = p.tryMeleeCombo(0);
    const b1 = nBullets();
    out.super = p.tryFireSuper(0);
    out.superPellets = nBullets() - b1;
    return out;
  };
  const res = {};
  p.equipSecondary('cluster');
  await new Promise((r) => setTimeout(r, 250));
  res.armedCluster = probe('ARMED (cluster)');
  res.pickupsBefore = gs.weaponPickups.length;
  gs.events.emit('boss-disarm', gs.boss);
  await new Promise((r) => setTimeout(r, 250));
  res.disarmedCluster = probe('DISARMED (had cluster)');
  res.pickupsAfter = gs.weaponPickups.length;
  const wp = gs.weaponPickups.at(-1);
  res.drop = wp ? { fromPlayer: Math.round(Math.hypot(wp.sprite.x - p.x, wp.sprite.y - p.y)),
                    fromBoss:   Math.round(Math.hypot(wp.sprite.x - gs.boss.x, wp.sprite.y - gs.boss.y)) } : null;
  p.equipSecondary('rifle');
  await new Promise((r) => setTimeout(r, 250));
  res.armedRifle = probe('ARMED (rifle)');
  gs.events.emit('boss-disarm', gs.boss);
  await new Promise((r) => setTimeout(r, 250));
  res.disarmedRifle = probe('DISARMED (had rifle)');
  p._equipNothing();
  const n0 = gs.weaponPickups.length;
  let banners = [];
  const spy = (t) => banners.push(t);
  gs.events.on('show-banner', spy);
  gs.events.emit('boss-disarm', gs.boss);
  await new Promise((r) => setTimeout(r, 250));
  gs.events.off('show-banner', spy);
  res.emptyHanded = { pickupsAdded: gs.weaponPickups.length - n0, banners };
  res.noDurationFlag = Object.keys(p).filter((k) => /disarm/i.test(k));
  return res;
});

writeFileSync(`${OUT}/raw.json`, JSON.stringify(R, null, 2));
console.log(JSON.stringify(R, null, 2));
await browser.close();
