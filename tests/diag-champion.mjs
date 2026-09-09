// The Champion in a LIVE encounter — print-only.
//
// `smoke-champion` owns the structure; this answers the questions a structural
// check cannot: how much of the fight is the floor actually claimed for, how
// often each move really fires, and whether PURGE stays silent against a player
// who keeps their distance (which is the whole reason it is a conditional move
// rather than a second attack).
//
// It asserts nothing. Every number here is a handset question in waiting.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
page.on('pageerror', (e) => { console.error('page error:', e); process.exit(1); });

await page.goto('http://localhost:5173/?nodlg=1&champdbg=1&encdbg=mixed&room=hangar&sector=6');
await page.waitForTimeout(4500);
await page.mouse.click(360, 640);
await page.waitForTimeout(800);
await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 8080 }));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(2000);

// Sample from INSIDE the page on a postupdate hook. Polling from the harness
// costs 200-400ms a round trip and would miss most of a 320ms act beat.
await page.evaluate(async () => {
  const { setGodMode } = await import('/src/systems/debug.js');
  setGodMode(true);                       // the instrument must not die mid-measurement
  const gs = window.game.scene.getScene('Game');
  const S = { frames: 0, ms: 0, hazardFrames: 0, maxHaz: 0, casts: {}, claimed: 0 };
  window.__S = S;
  if (!gs.enemies.getChildren().some((e) => e.alive && e.isChampion)) {
    gs.spawnChampion(gs.player.x + 500, gs.player.y);
  }
  const arenaArea = gs.physics.world.bounds.width * gs.physics.world.bounds.height;
  gs.events.on('postupdate', () => {
    const d = gs.game.loop.delta;
    S.frames++; S.ms += d;
    const n = gs._hazards.length;
    if (n > 0) S.hazardFrames++;
    S.maxHaz = Math.max(S.maxHaz, n);
    for (const h of gs._hazards) S.claimed += (h.len * h.width / arenaArea) * d;
    for (const e of gs.enemies.getChildren()) {
      if (!e.isChampion) continue;
      const m = e._activeMove;
      if (m && m.move && !m._counted && m.phase === 'act') {
        m._counted = true;
        S.casts[m.move.id] = (S.casts[m.move.id] || 0) + 1;
      }
    }
  });
});

// ── Station 1: the player keeps its distance ───────────────────────────────
await page.waitForTimeout(32000);
const far = await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  const c = gs.enemies.getChildren().find((e) => e.alive && e.isChampion);
  const S = window.__S;
  return { ...S, casts: { ...S.casts }, sep: c ? Math.round(Math.hypot(c.x - gs.player.x, c.y - gs.player.y)) : null };
});

// ── Station 2: the player comes inside ─────────────────────────────────────
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  const c = gs.enemies.getChildren().find((e) => e.alive && e.isChampion);
  window.__S.casts = {}; window.__S.mark = true;
  if (c) { gs.player.setPosition(c.x + 90, c.y + 40); gs.player.hp = gs.player.hpMax; }
  // Hold the player on top of it — this is the answer PURGE exists to punish.
  window.__hug = setInterval(() => {
    const cc = gs.enemies.getChildren().find((e) => e.alive && e.isChampion);
    if (cc) { gs.player.setPosition(cc.x + 90, cc.y + 40); gs.player.hp = gs.player.hpMax; }
  }, 120);
});
await page.waitForTimeout(16000);
const near = await page.evaluate(() => {
  clearInterval(window.__hug);
  const gs = window.game.scene.getScene('Game');
  return { casts: { ...window.__S.casts }, hazards: gs._hazards.length,
    alive: gs.enemies.getChildren().filter((e) => e.alive && e.isChampion).length };
});

// ── Teardown: nothing may be left behind ───────────────────────────────────
const leftovers = await page.evaluate(async () => {
  const { ROOMS } = await import('/src/data/rooms.js');
  const gs = window.game.scene.getScene('Game');
  gs.loadRoom(ROOMS.find((r) => r.id === 'corridor'));
  await new Promise((r) => setTimeout(r, 1200));
  return { hazards: gs._hazards.length,
    champions: gs.enemies.getChildren().filter((e) => e.isChampion).length };
});

await browser.close();

const secs = (far.ms / 1000);
console.log('\n══ THE INTERDICTOR IN A LIVE ENCOUNTER ═══════════════════════════════');
console.log(`\n  Station 1 — the player keeps its distance (${secs.toFixed(0)}s, ${far.frames} frames)`);
console.log(`    casts                 ${JSON.stringify(far.casts)}`);
console.log(`    seam present          ${(100 * far.hazardFrames / far.frames).toFixed(0)}% of frames`);
console.log(`    max seams at once     ${far.maxHaz}   (the design bound is 1 per Champion)`);
console.log(`    arena floor claimed   ${(100 * far.claimed / far.ms).toFixed(2)}% (time-weighted)`);
console.log(`    separation held       ${far.sep}px`);
console.log('\n  Station 2 — the player stands on it for 16s');
console.log(`    casts                 ${JSON.stringify(near.casts)}`);
console.log(`    champion alive        ${near.alive}`);
console.log('\n  Teardown after a room change');
console.log(`    hazards ${leftovers.hazards}   champions ${leftovers.champions}\n`);
