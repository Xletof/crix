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

// DEBUG button: cardY = 1280*0.06, baseY = cardY + 410, gap*6 (CONTROLS took gap*5).
await page.mouse.click(360, Math.round(1280 * 0.06 + 410 + 92 * 6));
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
// REFILL DASH moved off centre when CAM DBG took the free half of this row —
// the debug card is 1168 tall and CLOSE already sits within a few px of its
// border, so the camera toggle had nowhere else to go. This file walks the
// panel BY COORDINATE, so a button that moves and is not mirrored here taps
// empty card and reads as "the feature is broken": that is exactly how it
// failed, as `dash not refilled: 0`.
pos.dash = [cx - half, y]; pos.camDbg = [cx + half, y]; y += row;
heading(); pos.type = [cx - half, y]; pos.spawn = [cx + half, y]; y += row;
pos.clear = [cx - half, y]; pos.skip = [cx + half, y]; y += row;
// BOSSES — the proving ground. Mirrored here because this file walks the panel
// by coordinate; a group added to the scene without adding it here silently
// moves CLOSE out from under the tap and reads as "the panel will not close".
heading(); pos.loadout = [cx - half, y]; pos.spawnNemesis = [cx + half, y]; y += row;
pos.vaderN = [cx - half, y]; pos.spawnVader = [cx + half, y]; y += row;
pos.loadChamber = [cx, y]; y += row;          // full width
pos.loadJunction = [cx, y]; y += row;         // full width
pos.loadDetention = [cx, y]; y += row;        // full width
pos.sector = [cx - half, y]; pos.clearField = [cx + half, y]; y += row;
pos.forceMove = [cx, y]; y += row + 12;
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

// ── The proving ground ───────────────────────────────────────────────────
// Its whole purpose is to reach a boss without playing to it, so the check is
// that a tap produces one. Done last because these buttons close the panel on
// purpose — you asked to see the boss, not to keep reading a menu.
const reopen = async () => {
  await page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    gs.scene.launch('Debug', { game: gs });
    gs.scene.pause(); gs.scene.pause('HUD');
  });
  await page.waitForTimeout(600);
};

await reopen();
await tap('spawnNemesis');
await page.waitForTimeout(700);
const nemesisSpawned = await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  const n = gs.enemies.getChildren().find((e) => e.alive && e._nemesis);
  return n ? { name: n._nemesis.name, traits: n._nemesis.traits.length, closed: !window.game.scene.getScene('Debug')?.sys?.isActive() } : null;
});

await reopen();
await page.evaluate(() => { window.game.scene.getScene('Debug')._vaderN = 3; });
await tap('spawnVader');
await page.waitForTimeout(900);
const vaderSpawned = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  if (!gs.boss) return null;
  // Compared against the LADDER, not against a count. `n mechanics at
  // encounter n` was only ever true while the ladder was one row per rung, and
  // it is the debug tool's whole job to reproduce a real encounter exactly.
  const { bossMechanicsFor } = await import('/src/config.js');
  return {
    hpMax: gs.boss.hpMax, sector: gs.sector,
    mechanics: (gs.boss._mechanics || []).join(','),
    expected: bossMechanicsFor(3).map((m) => m.id).join(','),
  };
});

await reopen();
await tap('clearField');
await page.waitForTimeout(500);
const fieldCleared = await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  return { boss: !!gs.boss, nemesis: gs.enemies.getChildren().filter((e) => e.alive && e._nemesis).length };
});
await page.evaluate(() => window.game.scene.getScene('Debug')?._close?.());
await page.waitForTimeout(400);

// ── LOAD VADER CHAMBER ───────────────────────────────────────────────────
// The way in to the environment pilot. SPAWN VADER deliberately does not
// change rooms, so before this button the only route to the pilot arena was
// four sectors of endless — and the obvious debug workflow showed Vader
// standing in the hangar.
//
// Last, and after CLEAR FIELD, on purpose: `loadRoom` tears the arena down, so
// running it earlier would satisfy the CLEAR FIELD assertions above for the
// wrong reason.
const roomBefore = await page.evaluate(() => window.game.scene.getScene('Game').roomSpec?.id);
await reopen();
await tap('loadChamber');
await page.waitForTimeout(2200);
const chamberLoaded = await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  const spec = gs.roomSpec;
  return {
    roomId: spec?.id,
    isBossRoom: !!spec?.boss,
    // The pilot's own markers, so this cannot pass on a room that merely has
    // the right id.
    archCount: (spec?.floor?.architecture || []).length,
    perimeterStyle: spec?.perimeter?.style,
    envLightParts: gs.envLight?.parts?.length ?? 0,
    // It must NOT spawn a boss — that stays SPAWN VADER's job.
    bossSpawned: !!gs.boss,
    closed: !window.game.scene.getScene('Debug')?.sys?.isActive(),
  };
});
await page.evaluate(() => window.game.scene.getScene('Debug')?._close?.());
await page.waitForTimeout(300);

// ── LOAD REACTOR JUNCTION ────────────────────────────────────────────────
// The third styled arena's way in, and it has the same justification as the
// chamber's: the junction is the SECOND room of an endless run, so reaching it
// costs a full hangar clear and re-entering it after leaving costs three more
// rooms. Asserted from the chamber, which is where the previous block left the
// run — so a button that silently did nothing would read as "still in vader".
await reopen();
await tap('loadJunction');
await page.waitForTimeout(2200);
const junctionLoaded = await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  const spec = gs.roomSpec;
  return {
    roomId: spec?.id,
    isBossRoom: !!spec?.boss,
    // The junction's own markers, so this cannot pass on a room that merely
    // has the right id.
    archCount: (spec?.floor?.architecture || []).length,
    perimeterStyle: spec?.perimeter?.style,
    envLightParts: gs.envLight?.parts?.length ?? 0,
    bossSpawned: !!gs.boss,
    closed: !window.game.scene.getScene('Debug')?.sys?.isActive(),
  };
});
await page.evaluate(() => window.game.scene.getScene('Debug')?._close?.());
await page.waitForTimeout(300);

// ── LOAD DETENTION BLOCK ─────────────────────────────────────────────────
// The fourth arena's way in, and it needs one more than either of the others:
// detention is the LAST room of the rotation (`_arenaCycle` starts at 1, so
// hangar -> junction -> detention), which costs a hangar clear AND a junction
// clear to reach. Asserted from the junction, where the previous block left
// the run, so a button that silently did nothing reads as "still in corridor".
await reopen();
await tap('loadDetention');
await page.waitForTimeout(2200);
const detentionLoaded = await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  const spec = gs.roomSpec;
  return {
    roomId: spec?.id,
    isBossRoom: !!spec?.boss,
    // Detention's own markers, so this cannot pass on a room that merely has
    // the right id.
    archCount: (spec?.floor?.architecture || []).length,
    perimeterStyle: spec?.perimeter?.style,
    envLightParts: gs.envLight?.parts?.length ?? 0,
    bossSpawned: !!gs.boss,
    closed: !window.game.scene.getScene('Debug')?.sys?.isActive(),
  };
});
await page.evaluate(() => window.game.scene.getScene('Debug')?._close?.());
await page.waitForTimeout(300);

console.log(JSON.stringify({ pauseOpen, before, after, hud, god, spawnBefore, spawnAfter, closed,
  nemesisSpawned, vaderSpawned, fieldCleared, roomBefore, chamberLoaded, junctionLoaded,
  detentionLoaded }, null, 2));
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
if (!nemesisSpawned) fails.push('SPAWN NEMESIS produced no nemesis — the proving ground cannot reach a side boss');
else if (!nemesisSpawned.closed) fails.push('SPAWN NEMESIS left the panel open over the thing it just spawned');
if (!vaderSpawned) fails.push('SPAWN VADER produced no boss');
else if (vaderSpawned.mechanics !== vaderSpawned.expected || vaderSpawned.sector !== 15) {
  fails.push(`VADER #3 should be sector 15 carrying [${vaderSpawned.expected}], got sector ${vaderSpawned.sector} / [${vaderSpawned.mechanics}] — the encounter number is derived from the sector, so this is the whole feature`);
}
if (fieldCleared?.boss || fieldCleared?.nemesis) {
  fails.push(`CLEAR FIELD left ${fieldCleared.nemesis} nemesis / boss=${fieldCleared.boss}`);
}
if (roomBefore === 'vader') {
  fails.push('the run was already in the boss room before LOAD VADER CHAMBER — the check proves nothing');
}
if (!chamberLoaded) fails.push('LOAD VADER CHAMBER produced no readout');
else {
  if (chamberLoaded.roomId !== 'vader' || !chamberLoaded.isBossRoom) {
    fails.push(`LOAD VADER CHAMBER left the run in '${chamberLoaded.roomId}' — the pilot arena is unreachable from debug again`);
  }
  if (!chamberLoaded.archCount || chamberLoaded.perimeterStyle !== 'chamber' || !chamberLoaded.envLightParts) {
    fails.push(`the loaded room is not carrying the pilot: arch ${chamberLoaded.archCount}, perimeter ${chamberLoaded.perimeterStyle}, env parts ${chamberLoaded.envLightParts}`);
  }
  if (chamberLoaded.bossSpawned) {
    fails.push('LOAD VADER CHAMBER spawned a boss — it loads the room and stops; SPAWN VADER keeps that job');
  }
  if (!chamberLoaded.closed) fails.push('LOAD VADER CHAMBER left the panel open over the room it just loaded');
}
if (!junctionLoaded) fails.push('LOAD REACTOR JUNCTION produced no readout');
else {
  if (junctionLoaded.roomId !== 'corridor' || junctionLoaded.isBossRoom) {
    fails.push(`LOAD REACTOR JUNCTION left the run in '${junctionLoaded.roomId}' — the third arena is unreachable from debug`);
  }
  if (!junctionLoaded.archCount || junctionLoaded.perimeterStyle !== 'junction' || !junctionLoaded.envLightParts) {
    fails.push(`the loaded room is not carrying the junction: arch ${junctionLoaded.archCount}, perimeter ${junctionLoaded.perimeterStyle}, env parts ${junctionLoaded.envLightParts}`);
  }
  if (junctionLoaded.bossSpawned) {
    fails.push('LOAD REACTOR JUNCTION spawned a boss — it loads the room and stops');
  }
  if (!junctionLoaded.closed) fails.push('LOAD REACTOR JUNCTION left the panel open over the room it just loaded');
}
if (!detentionLoaded) fails.push('LOAD DETENTION BLOCK produced no readout');
else {
  if (detentionLoaded.roomId !== 'detention' || detentionLoaded.isBossRoom) {
    fails.push(`LOAD DETENTION BLOCK left the run in '${detentionLoaded.roomId}' — the fourth arena is unreachable from debug`);
  }
  if (!detentionLoaded.archCount || detentionLoaded.perimeterStyle !== 'block' || !detentionLoaded.envLightParts) {
    fails.push(`the loaded room is not carrying detention: arch ${detentionLoaded.archCount}, perimeter ${detentionLoaded.perimeterStyle}, env parts ${detentionLoaded.envLightParts}`);
  }
  if (detentionLoaded.bossSpawned) {
    fails.push('LOAD DETENTION BLOCK spawned a boss — it loads the room and stops');
  }
  if (!detentionLoaded.closed) fails.push('LOAD DETENTION BLOCK left the panel open over the room it just loaded');
}
if (errors.length) fails.push(`page errors: ${errors.join(' | ')}`);

console.log(fails.length ? `\nFAIL:\n - ${fails.join('\n - ')}` : '\nPASS: debug menu works and the HUD stays in sync');
await browser.close();
process.exit(fails.length ? 1 : 0);
