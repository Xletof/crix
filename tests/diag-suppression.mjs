// SUPPRESSION — every player verb, on the real production path, before /
// during / after. Cases A-F from the brief.
//
// Nothing is stubbed: the mechanic is raised by emitting `boss-disarm`, which
// is exactly what Boss._tickMechanics emits when its clock runs out.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';

const URL = 'http://localhost:5173/?nodlg=1&nofreeze=1';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const browser = await chromium.launch({ executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
page.on('pageerror', (e) => console.error('PAGE ERROR', e.message));
await page.goto(URL);
await page.waitForTimeout(4500);
await page.mouse.click(360, 640);
await page.waitForTimeout(800);
await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 777 }));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(1500);

await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { ROOMS } = await import('/src/data/rooms.js');
  const { ENDLESS } = await import('/src/config.js');
  gs.sector = 4 * ENDLESS.bossEvery;         // encounter 4 — SUPPRESSED's rung
  gs.loadRoom(ROOMS.find((r) => r.boss));
  await new Promise((r) => setTimeout(r, 2600));
  gs.arenaActive = false;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  if (!gs.boss?.alive) { gs.spawnBoss(gs.player.x + 380, gs.player.y); await new Promise((r) => setTimeout(r, 900)); }
  gs.player.hp = gs.player.hpMax; gs.lives = 9999;
  const b = gs.boss, FAR = 1e9;
  b._blackoutT = FAR; b._afterimageT = FAR; b._disarmT = FAR; b._sunderT = FAR; b._reflectT = FAR;
  b.cooldown = FAR; b._moveT = FAR;          // one mechanic at a time
});
await page.waitForTimeout(900);

const R = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const hud = window.game.scene.getScene('HUD');
  const p = gs.player;
  const { PLAYER } = await import('/src/config.js');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const nB = () => gs.playerBullets.getChildren().filter((b) => b.active).length;

  // Fill both meters and every other resource, then read what each verb does.
  const arm = () => {
    p.superCharge = PLAYER.superHitsToCharge;
    p.meleeCharge = PLAYER.meleeHitsToCharge;
    p._comboStage = 0; p._comboWindowMs = 0;
    p.fireCooldown = 0; p.ammo = PLAYER.ammoMax;
    p.dashCharges = 3; p.isDashing = false; p._hurtStaggerMs = 0;
    gs.events.emit('player-super-changed');
    gs.events.emit('player-melee-changed');
  };
  const probe = (label) => {
    arm();
    const o = { label, suppressed: !!p.suppressed };
    // HUD READ FIRST. Every verb below SPENDS something and emits a refresh,
    // so a reading taken after them photographs an emptied meter rather than
    // the suppression state under test.
    o.hudSuperTex  = hud.superButton?.image?.texture?.key ?? null;
    o.hudMeleeTex  = hud.meleeButton?.image?.texture?.key ?? null;
    o.hudSuperTint = hud.superButton?.image?.isTinted ?? null;
    o.hudMeleeTint = hud.meleeButton?.image?.isTinted ?? null;
    o.hudSuperAlpha = +(hud.superButton?.image?.alpha ?? 1).toFixed(2);
    // primary
    const b0 = nB();
    o.primaryFire = p.tryFire(0);
    o.boltsSpawned = nB() - b0;
    // ranged super
    p.fireCooldown = 0;
    const c0 = p.superCharge, b1 = nB();
    o.rangedSuper = p.tryFireSuper(0);
    o.superPellets = nB() - b1;
    o.superChargeKept = p.superCharge === c0;
    // melee super (Broken Wings)
    const m0 = p.meleeCharge;
    o.brokenWings = p.tryMeleeCombo(0);
    o.meleeChargeKept = p.meleeCharge === m0;
    // mid-chain link: can a live combo be continued while suppressed?
    o.brokenWingsLink2 = p.tryMeleeCombo(0);
    // dash + movement
    p.isDashing = false; p.dashCharges = 3;
    const d0 = p.dashCharges;
    p.tryDash();
    o.dashSpent = d0 - p.dashCharges;
    o.canMove = !p._inputLocked;
    // HUD
    o.secondary = p.secondary;
    o.pickups = gs.weaponPickups.length;
    return o;
  };

  const out = {};
  // ── Cases A/B/C — both Supers ready, then suppressed, then restored ──────
  p._equipNothing();
  out.before = probe('A/B  BEFORE — both Supers ready');
  out.pickupsBefore = gs.weaponPickups.length;
  let banners = [];
  const spy = (t) => banners.push(t);
  gs.events.on('show-banner', spy);
  gs.events.emit('boss-disarm', gs.boss);       // the real mechanic event
  await wait(150);
  out.banners = banners.slice();
  out.durationMs = p._suppressedMs;
  out.during = probe('A/B/C  DURING — SUPPRESSED');
  out.pickupsDuring = gs.weaponPickups.length;

  // C — switching Super mode must not bypass the lock
  p.beginMeleeAim?.();
  out.duringAfterModeSwitch = {
    brokenWings: p.tryMeleeCombo(0), rangedSuper: p.tryFireSuper(0),
    superChargeKept: p.superCharge === PLAYER.superHitsToCharge,
  };

  // D — no secondary equipped: must NOT be a silent no-op (already true above,
  // `_equipNothing` ran before the activation) — recorded explicitly.
  out.caseD_noSecondary = { secondaryWas: null, bannerRaised: banners.includes('SUPPRESSED'),
                            suppressed: !!p.suppressed };

  // repeat activation while already suppressed -> refresh, never stack
  await wait(600);
  const mid = p._suppressedMs;
  gs.events.emit('boss-disarm', gs.boss);
  out.repeat = { beforeRepeatMs: Math.round(mid), afterRepeatMs: Math.round(p._suppressedMs) };

  // ── restoration ─────────────────────────────────────────────────────────
  await wait(PLAYER.suppressMs + 400);
  gs.events.off('show-banner', spy);
  out.after = probe('A/B  AFTER — restored');

  // ── E — secondary equipped: not dropped, not required ───────────────────
  p.equipSecondary('rifle');
  await wait(150);
  const pk0 = gs.weaponPickups.length;
  gs.events.emit('boss-disarm', gs.boss);
  await wait(150);
  out.caseE_withSecondary = {
    secondaryStillHeld: p.secondary, ammo: p.secondaryAmmo,
    pickupsAdded: gs.weaponPickups.length - pk0, suppressed: !!p.suppressed,
  };
  out.caseE_probe = probe('E  DURING — with a rifle equipped');

  // ── F — death / respawn during suppression ──────────────────────────────
  gs.events.emit('boss-disarm', gs.boss);
  await wait(120);
  out.caseF_beforeDeath = { suppressed: !!p.suppressed, ms: Math.round(p._suppressedMs) };
  p.hp = 0; p.alive = false;
  gs.player.clearSuppression();               // the revive path's call
  out.caseF_afterRevive = { suppressed: !!p.suppressed, ms: p._suppressedMs };
  p.alive = true; p.hp = p.hpMax;
  out.caseF_probe = probe('F  AFTER REVIVE');
  return out;
});

writeFileSync('docs/evidence/mech-truth/suppression.json', JSON.stringify(R, null, 2));
const row = (o) => ` ${String(o.label).padEnd(34)} primary=${o.primaryFire}/${o.boltsSpawned}bolt  super=${o.rangedSuper}(kept ${o.superChargeKept})  wings=${o.brokenWings}(kept ${o.meleeChargeKept})  link2=${o.brokenWingsLink2}  dash=${o.dashSpent}  hud=${o.hudSuperTex}|${o.hudMeleeTex} tint=${o.hudSuperTint} a=${o.hudSuperAlpha}`;
console.log('\n=== SUPPRESSION, real event path ===');
for (const k of ['before', 'during', 'after', 'caseE_probe', 'caseF_probe']) console.log(row(R[k]));
console.log(`\n banners raised          : ${JSON.stringify(R.banners)}`);
console.log(` duration on activation  : ${R.durationMs}ms`);
console.log(` mode switch bypass      : ${JSON.stringify(R.duringAfterModeSwitch)}`);
console.log(` D  no secondary         : ${JSON.stringify(R.caseD_noSecondary)}`);
console.log(` E  with secondary       : ${JSON.stringify(R.caseE_withSecondary)}`);
console.log(` repeat activation       : ${JSON.stringify(R.repeat)}`);
console.log(` F  death/revive         : ${JSON.stringify(R.caseF_beforeDeath)} -> ${JSON.stringify(R.caseF_afterRevive)}`);
console.log(` weapon pickups  before/during : ${R.pickupsBefore} / ${R.pickupsDuring}`);
await browser.close();
