// EVIDENCE — THE ROSTER, PHASE B: the Shock Captain in PRODUCTION placement.
//
//   node tests/shot-champion-placement.mjs            all three cases
//   node tests/shot-champion-placement.mjs A          one case
//
// DIAGNOSTIC STILLS, NOT A VERDICT. Full-speed handset play is the authority;
// these exist so the human can see what the three review cases put on screen
// before playing them. Every frame is the live game at 720x1280, 1x, reached
// through the SAME URLs the handset uses — the placement is the production one,
// and nothing here spawns a Champion by hand.
//
// The player is invulnerable and stands where the fight is; the enemies run
// their own AI. The camera is the real director (a paused scene cannot be
// overwritten by it). The camera flash, the room banner and the sector tint are
// killed at the shutter for the reasons `HANDOVER.md` §10y records.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = 'docs/evidence/champion-integration';
const BASE = 'http://localhost:5173/';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
mkdirSync(OUT, { recursive: true });

const CASES = {
  A: { q: '?nodlg=1&nofreeze=1&encdbg=1&room=hangar&sector=8&wave=2', tag: 'A-vanguard-captain', cap: true },
  B: { q: '?nodlg=1&nofreeze=1&encdbg=1&room=hangar&sector=8&wave=2&nochamp=1', tag: 'B-vanguard-baseline', cap: false },
  C: { q: '?nodlg=1&nofreeze=1&encdbg=1&room=hangar&sector=16&wave=3', tag: 'C-crossfire-captain', cap: true },
};
const only = process.argv[2];

const browser = await chromium.launch({ executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'] });

for (const [id, cs] of Object.entries(CASES)) {
  if (only && only !== id) continue;
  console.log(`case ${id} — ${cs.tag}`);
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  page.on('pageerror', (e) => console.error('PAGE ERROR', String(e)));
  await page.goto(BASE + cs.q);
  await page.waitForTimeout(4500);
  await page.mouse.click(360, 640);
  await page.waitForTimeout(800);
  await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 4242 }));
  await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?._wave, null, { timeout: 20000 });

  // Invulnerable, and standing ~520px in front of the gate the wave uses, so
  // the formation and its front are in frame when it arrives.
  await page.evaluate(async () => {
    const { setGodMode } = await import('/src/systems/debug.js');
    setGodMode(true);
    const gs = window.game.scene.getScene('Game');
    gs.lives = 9999;
    // The same modifier-free room in every case, so the three differ only in
    // what the encounter puts on the floor (endless rolls one per room load).
    gs._roomModifier = null;
    gs.events.emit('modifier-active', null, null);
    gs.events.emit('set-darkness', false);
    const g = (gs._gatePlan && gs._gatePlan[0]) || gs.roomSpec.gates[0];
    const cx = gs.roomSpec.bounds.w / 2, cy = gs.roomSpec.bounds.h / 2;
    const dx = cx - g.x, dy = cy - g.y, d = Math.hypot(dx, dy) || 1;
    gs.player.setPosition(g.x + (dx / d) * 520, g.y + (dy / d) * 520);
    gs.cameraDirector?.reset(gs.player.x, gs.player.y);
  });

  const hush = () => page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    gs._sectorTint?.setAlpha(0);
    gs.cameras.main.resetFX();
    window.game.scene.getScene('HUD')?.hud?.banner?.setAlpha(0);
    gs.player.hp = gs.player.hpMax;
  });
  const shoot = async (name) => {
    await hush();
    await page.evaluate(() => window.game.scene.getScene('Game').scene.pause());
    writeFileSync(`${OUT}/${cs.tag}-${name}.png`, await page.screenshot());
    const st = await page.evaluate(() => {
      const gs = window.game.scene.getScene('Game');
      const alive = gs.enemies.getChildren().filter((e) => e.alive);
      const c = alive.find((e) => e.isChampion);
      const bolts = gs.hostileBullets.reduce((n, g) => n + (g?.countActive?.(true) || 0), 0);
      return { alive: alive.length, captain: c ? c._cap : null, bolts, telegraphs: gs._telegraphs?.length ?? 0 };
    });
    await page.evaluate(() => window.game.scene.getScene('Game').scene.resume());
    console.log(`   ${name}  alive ${st.alive}  captain ${st.captain ?? '-'}  hostile bolts ${st.bolts}`);
  };
  // Poll the live game for a condition rather than sleeping a fixed time —
  // a fixed window against a chase is a frame-rate meter (CLAUDE.md).
  const until = async (fn, ms) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      if (await page.evaluate(fn)) return true;
      await page.waitForTimeout(120);
    }
    return false;
  };

  await page.waitForTimeout(2600);
  await shoot('1-entry');
  await page.waitForTimeout(3200);
  await shoot('2-dense');
  if (cs.cap) {
    const cap = () => window.game.scene.getScene('Game').enemies.getChildren().find((e) => e.alive && e.isChampion);
    if (await until(`(${cap})()?._cap === 'burst'`, 12000)) await shoot('3-captain-firing');
    else console.log('   (no burst inside the window)');
    if (await until(`(${cap})()?._cap === 'step'`, 12000)) await shoot('4-step');
    else console.log('   (no step inside the window)');
    if (await until(`!!(${cap})()?._nade?.live`, 14000)) await shoot('5-arc-grenade');
    else console.log('   (no grenade inside the window)');
  } else {
    await page.waitForTimeout(2500);
    await shoot('3-front');
  }
  // Late fight: half the rank and file gone, the rest still standing.
  await page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    const ord = gs.enemies.getChildren().filter((e) => e.alive && !e.isChampion);
    ord.slice(0, Math.ceil(ord.length / 2)).forEach((e) => e.die());
  });
  await page.waitForTimeout(2500);
  await shoot('6-late');
  await page.close();
}

await browser.close();
console.log(`frames in ${OUT}`);
