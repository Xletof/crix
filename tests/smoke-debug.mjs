// Debug menu.
//
// Drives it by real pointer taps through the pause overlay, and after each
// action checks BOTH the player state and what the HUD is rendering. The whole
// risk with a debug menu is those two diverging: the HUD renders from events on
// the GameScene emitter, so a direct field write with no emit leaves it stale.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const OUT = new URL('./out/', import.meta.url).pathname;

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto('http://localhost:5173/');
await page.waitForTimeout(4000);
await page.mouse.click(360, 640);
await page.waitForTimeout(600);
await page.evaluate(() => {
  const t = window.game?.scene?.getScene('Title');
  if (t?.sys?.isActive()) t.scene.start('Game');
});
await page.waitForFunction(() => {
  const gs = window.game?.scene?.getScene('Game');
  return !!(gs?.player && gs?.enemies);
}, null, { timeout: 20000 });
await page.waitForTimeout(1500);

// Spend some resources first, so a refill has something to actually restore.
await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const p = gs.player;
  p.hp = Math.round(p.hpMax * 0.35);
  gs.events.emit('player-hp-changed');
  p.ammo = 0;
  p.ammoTimers = [400, 400, 400];
  gs.events.emit('player-ammo-changed');
  p.superCharge = 0; p.meleeCharge = 0; p.dashCharges = 0;
  gs.events.emit('player-super-changed');
  gs.events.emit('player-melee-changed');
});

// Open pause via the real HUD button, then the DEBUG row.
await page.mouse.click(676, 120);
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/debug-1-pause.png` });

const pauseOpen = await page.evaluate(() =>
  !!window.game.scene.getScene('Pause')?.sys?.isActive());

// DEBUG button: cardY = 1280*0.06, baseY = cardY + 410, gap*5.
await page.mouse.click(360, Math.round(1280 * 0.06 + 410 + 92 * 5));
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/debug-2-panel.png` });

const before = await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  const hud = window.game.scene.getScene('HUD');
  const p = gs.player;
  return {
    debugOpen: !!window.game.scene.getScene('Debug')?.sys?.isActive(),
    gamePaused: !gs.sys.isActive(),
    hp: Math.round(p.hp), ammo: p.ammo, timers: p.ammoTimers.length,
    superCharge: p.superCharge, meleeCharge: p.meleeCharge,
    dash: p.dashCharges, secondary: p.secondary, secondaryAmmo: p.secondaryAmmo,
    // setReady() swaps the button TEXTURE — there is no `ready` field. Reading
    // one that does not exist gives a permanent false, which is a test that can
    // only ever fail.
    hudSuperTex: hud?.superButton?.image?.texture?.key ?? null,
    hudMeleeTex: hud?.meleeButton?.image?.texture?.key ?? null,
  };
});

// Tap each control. Layout mirrors DebugScene.create().
const cx = 360, half = 152, row = 62;
const cardY = 1280 * 0.03;
let y = cardY + 96;
const pos = {};
const heading = () => { y += 34; };
heading(); pos.god = [cx - half, y]; pos.heal = [cx + half, y]; y += row;
heading(); pos.rifle = [cx - half, y]; pos.pod = [cx + half, y]; y += row;
pos.ammo = [cx - half, y]; pos.podAmmo = [cx + half, y]; y += row;
heading(); pos.superFill = [cx - half, y]; pos.meleeFill = [cx + half, y]; y += row;
pos.dash = [cx, y]; y += row;
heading(); pos.type = [cx - half, y]; pos.spawn = [cx + half, y]; y += row;
pos.clear = [cx - half, y]; pos.skip = [cx + half, y]; y += row + 12;
pos.close = [cx, y];

const tap = async (k) => {
  await page.mouse.click(Math.round(pos[k][0]), Math.round(pos[k][1]));
  await page.waitForTimeout(260);
};

for (const k of ['god', 'heal', 'pod', 'ammo', 'superFill', 'meleeFill', 'dash']) await tap(k);
await page.screenshot({ path: `${OUT}/debug-3-after.png` });

const after = await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  const p = gs.player;
  return {
    hp: Math.round(p.hp), hpMax: Math.round(p.hpMax),
    ammo: p.ammo, timers: p.ammoTimers.length,
    superCharge: p.superCharge, meleeCharge: p.meleeCharge,
    dash: p.dashCharges, secondary: p.secondary, secondaryAmmo: p.secondaryAmmo,
  };
});

// HUD sync — read what the HUD is actually rendering, not the player fields.
const hud = await page.evaluate(() => {
  const h = window.game.scene.getScene('HUD');
  return {
    superTex: h?.superButton?.image?.texture?.key ?? null,
    meleeTex: h?.meleeButton?.image?.texture?.key ?? null,
    secIconTex: h?.secIcon?.texture?.key ?? null,
    secIconVisible: !!h?.secIcon?.visible,
    secText: h?.secText?.text ?? null,
  };
});

// God mode: take a real hit.
const god = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const p = gs.player;
  const hpBefore = p.hp;
  p.damage(500, 0);
  return { hpBefore: Math.round(hpBefore), hpAfter: Math.round(p.hp) };
});

// Spawn, then close and confirm the game resumes.
const spawnBefore = await page.evaluate(() =>
  window.game.scene.getScene('Game').enemies.getChildren().filter((e) => e.alive).length);
await tap('spawn');
const spawnAfter = await page.evaluate(() =>
  window.game.scene.getScene('Game').enemies.getChildren().filter((e) => e.alive).length);

await tap('close');
await page.waitForTimeout(700);
const closed = await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  return {
    debugOpen: !!window.game.scene.getScene('Debug')?.sys?.isActive(),
    gameRunning: gs.sys.isActive(),
    hudRunning: window.game.scene.getScene('HUD').sys.isActive(),
  };
});
await page.screenshot({ path: `${OUT}/debug-4-resumed.png` });

console.log(JSON.stringify({ pauseOpen, before, after, hud, god, spawnBefore, spawnAfter, closed }, null, 2));
console.log('page errors:', errors.length ? errors : 'none');

const fails = [];
if (!pauseOpen) fails.push('pause menu did not open');
if (!before.debugOpen) fails.push('debug panel did not open from the pause menu');
if (!before.gamePaused) fails.push('game was not paused under the debug panel');
if (after.hp !== after.hpMax) fails.push(`full heal did not restore hp: ${after.hp}/${after.hpMax}`);
if (after.ammo !== 3) fails.push(`ammo refill wrong: ${after.ammo}`);
if (after.timers !== 0) fails.push(`ammoTimers not cleared (${after.timers}) — HUD will show a permanent reload`);
if (after.secondary !== 'cluster') fails.push(`give pod failed: secondary=${after.secondary}`);
if (!after.secondaryAmmo) fails.push('pod has no charges');
if (after.superCharge < 4) fails.push(`super not filled: ${after.superCharge}`);
if (after.meleeCharge < 3) fails.push(`melee not filled: ${after.meleeCharge}`);
if (after.dash < 2) fails.push(`dash not refilled: ${after.dash}`);
if (hud.superTex !== 'super-btn') fails.push(`HUD super button not showing ready (${hud.superTex}) — event desync`);
if (hud.meleeTex !== 'melee-btn') fails.push(`HUD melee button not showing ready (${hud.meleeTex}) — event desync`);
if (!hud.secIconVisible || hud.secIconTex !== 'pickup-cluster') {
  fails.push(`HUD secondary slot not showing the pod (${hud.secIconTex}, visible=${hud.secIconVisible}) — event desync`);
}
// Sanity: the pre-state must actually have been "not ready", or the post-state
// assertions above prove nothing.
if (before.hudSuperTex === 'super-btn') fails.push('super button was already ready before the test — no signal');
if (before.hudMeleeTex === 'melee-btn') fails.push('melee button was already ready before the test — no signal');
if (god.hpAfter !== god.hpBefore) fails.push(`god mode did not block damage: ${god.hpBefore} -> ${god.hpAfter}`);
if (spawnAfter <= spawnBefore) fails.push(`spawn did nothing: ${spawnBefore} -> ${spawnAfter}`);
if (closed.debugOpen) fails.push('debug panel did not close');
if (!closed.gameRunning) fails.push('game did not resume after closing');
if (!closed.hudRunning) fails.push('HUD did not resume after closing');
if (errors.length) fails.push(`page errors: ${errors.join(' | ')}`);

console.log(fails.length ? `\nFAIL:\n - ${fails.join('\n - ')}` : '\nPASS: debug menu works and the HUD stays in sync');
await browser.close();
process.exit(fails.length ? 1 : 0);
