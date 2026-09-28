// EVIDENCE — the Captain-VANGUARD after its opening: `d3766eb` vs the one
// guaranteed later shield, plus a surge fired during the front hold.
//
//   node tests/shot-vanguard-reinforce.mjs [oldBase]
//
// OLD is `d3766eb` served from a git worktree (default http://localhost:5174/):
// there is deliberately no debug switch for the reinforcement. NEW is the dev
// server on :5173. A seed is chosen on the OLD build whose natural slot 5 is
// NOT already a shield, so the pair differs where the change is.
//
// The player is invulnerable, planted, and never shoots; the rig kills the
// opening pair by hand once the Captain has arrived, which stands in for the
// player breaking the front. DIAGNOSTIC ONLY — handset play decides.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = 'docs/evidence/vanguard-reinforce';
const Q = '?nodlg=1&nofreeze=1&encdbg=1&room=hangar&sector=8&wave=2';
const OLD = process.argv[2] || 'http://localhost:5174/';
const NEW = 'http://localhost:5173/';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'] });

async function boot(base, seed) {
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  page.on('pageerror', (e) => console.error('PAGE ERROR', String(e)));
  await page.goto(base + Q);
  await page.waitForTimeout(4500);
  await page.mouse.click(360, 640);
  await page.waitForTimeout(800);
  await page.evaluate((s) => {
    const gs = window.game.scene.getScene('Game');
    const log = { gate: [], made: [] };
    window.__log = log;
    const sag = gs.spawnAtGate.bind(gs);
    gs.spawnAtGate = (t, g, sl) => { log.gate.push(t); return sag(t, g, sl); };
    const sea = gs.spawnEnemyAt.bind(gs);
    gs.spawnEnemyAt = (t, x, y, sp) => { const e = sea(t, x, y, sp); if (sp?.vanguardScreen || t !== 'shielded') log.made.push(e); return e; };
    const sc = gs.spawnChampion.bind(gs);
    gs.spawnChampion = (x, y, w) => { const e = sc(x, y, w); log.made.push(e); return e; };
    window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: s });
  }, seed);
  await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?._wave, null, { timeout: 20000 });
  return page;
}
const fullQueue = (page) => page.evaluate(() => [...window.__log.gate, ...(window.game.scene.getScene('Game')._spawnQueue || [])]);

// Choose a seed on the OLD build whose slot 5 is not already a shield.
let seed = null, oldQ = null;
for (let s = 1; s <= 40 && seed == null; s++) {
  const page = await boot(OLD, s);
  const q = await fullQueue(page);
  await page.close();
  if (q[5] !== 'shielded') { seed = s; oldQ = q; }
}
console.log(`seed ${seed}: OLD queue ${oldQ?.join(',')}`);

async function capture(tag, base, script) {
  const page = await boot(base, seed);
  console.log(`${tag}: queue ${(await fullQueue(page)).join(',')}`);
  await page.evaluate(async () => {
    const { setGodMode } = await import('/src/systems/debug.js');
    setGodMode(true);
    const gs = window.game.scene.getScene('Game');
    gs.lives = 9999;
    gs._roomModifier = null;
    gs.events.emit('modifier-active', null, null);
    gs.events.emit('set-darkness', false);
    const g = (gs._gatePlan && gs._gatePlan[0]) || gs.roomSpec.gates[0];
    const cx = gs.roomSpec.bounds.w / 2, cy = gs.roomSpec.bounds.h / 2;
    const dx = cx - g.x, dy = cy - g.y, d = Math.hypot(dx, dy) || 1;
    window.__P = { x: g.x + (dx / d) * 620, y: g.y + (dy / d) * 620 };
    gs.player.setPosition(window.__P.x, window.__P.y);
    gs.cameraDirector?.reset(gs.player.x, gs.player.y);
    setInterval(() => { gs.player.setPosition(window.__P.x, window.__P.y); gs.player.setVelocity(0, 0); gs.player.hp = gs.player.hpMax; }, 30);
  });
  const state = () => page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    const alive = gs.enemies.getChildren().filter((e) => e.alive);
    const f = gs._vanguardFront;
    return {
      shields: alive.filter((e) => e._archetype === 'shielded').length,
      pairAlive: f ? f.pair.filter((e) => e?.alive).length : '-',
      captain: alive.some((e) => e.isChampion),
      exposed: alive.filter((e) => !e.isChampion && e._archetype !== 'shielded').length,
      drawn: window.__log.gate.length, queue: (gs._spawnQueue || []).join(','),
      front: f ? (f.released ? f.why : 'holding') : 'off',
    };
  });
  // Pause from inside the page ON the frame a condition first holds; the next
  // condition is armed while still paused (see shot-vanguard-front).
  const arm = (expr) => page.evaluate((src) => {
    const gs = window.game.scene.getScene('Game');
    window.__hit = false;
    const fn = new Function(`return (${src});`);
    const h = () => { if (!window.__hit && fn()) { window.__hit = true; gs.events.off('postupdate', h); gs.scene.pause(); } };
    gs.events.on('postupdate', h);
  }, expr);
  const hit = async (ms = 25000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (await page.evaluate(() => window.__hit)) return true; await page.waitForTimeout(30); }
    console.log('   (timed out)');
    return false;
  };
  const shoot = async (name, next, act) => {
    await page.evaluate(() => {
      const gs = window.game.scene.getScene('Game');
      gs._sectorTint?.setAlpha(0); gs.cameras.main.resetFX();
      window.game.scene.getScene('HUD')?.hud?.banner?.setAlpha(0);
      gs.scene.pause();
    });
    writeFileSync(`${OUT}/${tag}-${name}.png`, await page.screenshot());
    const st = await state();
    console.log(`   ${name.padEnd(28)} shields ${st.shields} (opening alive ${st.pairAlive})  captain ${st.captain ? 'Y' : 'n'}  exposed ${st.exposed}  front ${st.front}  drawn ${st.drawn}`);
    if (act) await page.evaluate(act);
    if (next) await arm(next);
    await page.evaluate(() => window.game.scene.getScene('Game').scene.resume());
  };
  await script({ arm, hit, shoot, page });
  await page.close();
}

const made = (n) => `window.__log.made.length >= ${n}`;
const opening = async ({ arm, hit, shoot }) => {
  await arm(made(2)); await hit();
  await shoot('1-opening-pair', '!!window.__log.made.find((e) => e?.isChampion)');
  await hit();
  // The player breaks the front: both opening shields die here.
  await shoot('2-captain-arrives', made(4), `(() => { const f = window.game.scene.getScene('Game')._vanguardFront; (f ? f.pair : window.__log.made.slice(0, 2)).forEach((e) => e?.alive && e.die()); })()`);
  await hit();
  await shoot('3-event4-later-shield', made(6));
  await hit();
  await shoot('4-event6-reinforcement', `window.__log.made.length >= 8 || window.game.scene.getScene('Game')._wavePhase !== 'spawning'`);
  await hit();
  await shoot('5-opening-gone-mid-fight', null);
  await new Promise((r) => setTimeout(r, 2500));
  await shoot('6-late-fight', null, `(() => { const gs = window.game.scene.getScene('Game'); gs.enemies.getChildren().filter((e) => e.alive && !e.isChampion && e._archetype !== 'shielded').forEach((e) => e.die()); })()`);
  await new Promise((r) => setTimeout(r, 1500));
  await shoot('7-cleanup-what-remains', null);
};
await capture('old', OLD, opening);
await capture('new', NEW, opening);

// THE SURGE DURING THE HOLD — on the new build, where it can no longer take
// the Captain's token.
await capture('surge', NEW, async ({ arm, hit, shoot, page }) => {
  await arm(`window.game.scene.getScene('Game')._vanguardFront?.holdAt != null`);
  await hit();
  // Fire the surge, then pause ON the frame its bodies have landed — a fixed
  // wait outlived the hold and photographed the ordinary drip instead.
  await shoot('1-front-holding-before-surge',
    `window.__log.made.length >= window.__made0 + 3`,
    `(() => { const gs = window.game.scene.getScene('Game'); window.__snap = gs._spawnQueue.join(','); window.__made0 = window.__log.made.length; window.__gate0 = window.__log.gate.length; gs.triggerSurge(); })()`);
  await hit();
  const st = await page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    return { same: window.__snap === gs._spawnQueue.join(','), holding: !gs._vanguardFront.released,
      surge: window.__log.gate.slice(window.__gate0), captain: gs.enemies.getChildren().some((e) => e.alive && e.isChampion) };
  });
  await shoot('2-surge-landed-front-still-holding', null);
  console.log(`   surge drew ${st.surge.join(',')} · queue identical ${st.same} · front holding ${st.holding} · captain on floor ${st.captain}`);
});

await browser.close();
console.log(`frames in ${OUT}`);
