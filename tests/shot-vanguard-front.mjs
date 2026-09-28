// EVIDENCE — THE VANGUARD FRONT, `1b7c84d` timing vs the staged opening, at 1x.
//
//   node tests/shot-vanguard-front.mjs            everything
//   node tests/shot-vanguard-front.mjs A-new      one run
//
// OLD is `&nofront=1`: the 140px screen ON, no staging and no lanes — exactly
// the opening the handset played on `1b7c84d`. NEW is the build. Same seed,
// room, wave; modifier nulled. `breach` and `kite` are the two other release
// paths on the new build. Every frame also prints the opening pair's distance
// to the player and whether any backline actor exists yet.
//
// The `*-trails` frame draws the two opening shields' REAL sampled paths into
// the world at 1x (debug overlay, then removed) — the lanes, at gameplay scale.
//
// DIAGNOSTIC ONLY. The player is invulnerable and scripted. Handset play decides.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = 'docs/evidence/vanguard-front';
const BASE = 'http://localhost:5173/?nodlg=1&nofreeze=1&encdbg=1&room=hangar&sector=8&wave=2';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
mkdirSync(OUT, { recursive: true });

const RUNS = {
  'A-old': { q: '&nofront=1', script: 'opening' },
  'A-new': { q: '', script: 'opening' },
  'breach': { q: '', script: 'breach' },
  'kite': { q: '', script: 'kite' },
};
const only = process.argv[2];

const browser = await chromium.launch({ executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'] });

for (const [tag, run] of Object.entries(RUNS)) {
  if (only && only !== tag) continue;
  console.log(tag);
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  page.on('pageerror', (e) => console.error('PAGE ERROR', String(e)));
  await page.goto(BASE + run.q);
  await page.waitForTimeout(4500);
  await page.mouse.click(360, 640);
  await page.waitForTimeout(800);
  // Instrument the spawner before the wave drips, then start the run.
  await page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    const log = { gate: [], shields: [], captain: null, trails: [[], []] };
    window.__log = log;
    const sag = gs.spawnAtGate.bind(gs);
    gs.spawnAtGate = (t, g, s) => { log.gate.push({ t, at: gs.time.now }); return sag(t, g, s); };
    const sea = gs.spawnEnemyAt.bind(gs);
    gs.spawnEnemyAt = (t, x, y, sp) => { const e = sea(t, x, y, sp); if (t === 'shielded' && sp?.vanguardScreen) log.shields.push(e); return e; };
    const sc = gs.spawnChampion.bind(gs);
    gs.spawnChampion = (x, y, w) => { const e = sc(x, y, w); log.captain = e; return e; };
    window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 4242 });
  });
  await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?._wave, null, { timeout: 20000 });
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
    window.__P = { x: g.x + (dx / d) * 640, y: g.y + (dy / d) * 640 };
    window.__gate = g;
    gs.player.setPosition(window.__P.x, window.__P.y);
    gs.cameraDirector?.reset(gs.player.x, gs.player.y);
    // Keep the player planted unless a frame moves them; sample the pair's paths.
    window.__plant = true;
    setInterval(() => {
      const p = gs.player;
      if (window.__plant) { p.setPosition(window.__P.x, window.__P.y); p.setVelocity(0, 0); }
      window.__log.shields.slice(0, 2).forEach((e, i) => { if (e?.alive) window.__log.trails[i].push([e.x, e.y]); });
    }, 60);
  });

  const state = () => page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    const L = window.__log, p = gs.player;
    const pair = L.shields.slice(0, 2);
    const back = gs.enemies.getChildren().filter((e) => e.alive && !pair.includes(e));
    return {
      pair: pair.map((e) => (e?.alive ? Math.round(Math.hypot(e.x - p.x, e.y - p.y)) : 'x')),
      apart: pair.length === 2 && pair.every((e) => e.alive) ? Math.round(Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y)) : null,
      backline: back.filter((e) => !e.isChampion && e._archetype !== 'shielded').length + back.filter((e) => e.isChampion).length,
      gates: L.gate.length, front: gs._vanguardFront ? (gs._vanguardFront.released ? gs._vanguardFront.why : 'holding') : 'off',
    };
  });
  const shoot = async (name) => {
    await page.evaluate(() => {
      const gs = window.game.scene.getScene('Game');
      gs._sectorTint?.setAlpha(0);
      gs.cameras.main.resetFX();
      window.game.scene.getScene('HUD')?.hud?.banner?.setAlpha(0);
      gs.scene.pause();
    });
    writeFileSync(`${OUT}/${tag}-${name}.png`, await page.screenshot());
    const st = await state();
    await page.evaluate(() => window.game.scene.getScene('Game').scene.resume());
    console.log(`   ${name.padEnd(20)} pair ${JSON.stringify(st.pair)} apart ${st.apart ?? '-'}  backline ${st.backline}  gate events ${st.gates}  front ${st.front}`);
  };
  // Pause the scene ON THE FRAME a condition first holds, from inside the
  // page — a round trip from the rig lands hundreds of ms late in this harness.
  // arm() installs a pause-on-condition hook without waiting; hit() waits for
  // it. shootNext() arms the NEXT condition while the scene is still paused,
  // so no game time can pass between one frame and the hook for the next.
  const arm = (expr) => page.evaluate((src) => {
    const gs = window.game.scene.getScene('Game');
    window.__hit = false;
    const fn = new Function(`return (${src});`);
    const h = () => { if (!window.__hit && fn()) { window.__hit = true; gs.events.off('postupdate', h); gs.scene.pause(); } };
    gs.events.on('postupdate', h);
    window.__atH = h;
  }, expr);
  const hit = async (label, ms = 20000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (await page.evaluate(() => window.__hit)) return true; await page.waitForTimeout(30); }
    await page.evaluate(() => window.game.scene.getScene('Game').events.off('postupdate', window.__atH));
    console.log(`   (timed out waiting for ${label})`);
    return false;
  };
  const shootNext = async (name, next) => {
    await page.evaluate(() => {
      const gs = window.game.scene.getScene('Game');
      gs._sectorTint?.setAlpha(0);
      gs.cameras.main.resetFX();
      window.game.scene.getScene('HUD')?.hud?.banner?.setAlpha(0);
      gs.scene.pause();
    });
    writeFileSync(`${OUT}/${tag}-${name}.png`, await page.screenshot());
    const st = await state();
    console.log(`   ${name.padEnd(30)} pair ${JSON.stringify(st.pair)} apart ${st.apart ?? '-'}  backline ${st.backline}  gate events ${st.gates}  front ${st.front}`);
    if (next) await arm(next);
    await page.evaluate(() => window.game.scene.getScene('Game').scene.resume());
  };
  const at = async (expr, ms = 20000) => {
    await page.evaluate((src) => {
      const gs = window.game.scene.getScene('Game');
      window.__hit = false;
      const fn = new Function(`return (${src});`);
      const h = () => { if (!window.__hit && fn()) { window.__hit = true; gs.events.off('postupdate', h); gs.scene.pause(); } };
      gs.events.on('postupdate', h);
      window.__atH = h;
    }, expr);
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (await page.evaluate(() => window.__hit)) return true; await page.waitForTimeout(40); }
    await page.evaluate(() => window.game.scene.getScene('Game').events.off('postupdate', window.__atH));
    console.log(`   (timed out waiting: ${expr})`);
    return false;
  };
  const until = async (expr, ms = 20000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (await page.evaluate(expr)) return true; await page.waitForTimeout(40); }
    console.log(`   (timed out waiting: ${expr})`);
    return false;
  };
  const released = `(() => { const gs = window.game.scene.getScene('Game'); const f = gs._vanguardFront; return f ? f.released : window.__log.gate.length >= 3; })()`;

  if (run.script === 'opening') {
    const E = [
      ['01-shield1-telegraph', 'window.__log.gate.length >= 1'],
      ['02-shield1-present', 'window.__log.shields.length >= 1'],
      ['03-shield2-present', 'window.__log.shields.length >= 2'],
      ['04-shields-advancing', 'window.__log.shields.length >= 2 && window.__log.shields[1].alive && Math.hypot(window.__log.shields[1].x - window.__P.x, window.__log.shields[1].y - window.__P.y) < 300'],
      ['05-release-backline-telegraph', released],
      ['06-captain-arrives', '!!window.__log.captain'],
      ['07-front-at-hold', 'window.__log.shields.slice(0,2).every((e) => !e.alive || e._screenHolding)'],
    ];
    await arm(E[0][1]);
    for (let i = 0; i < E.length; i++) {
      await hit(E[i][0]);
      await shootNext(E[i][0], E[i + 1]?.[1]);
    }
    // The trails, drawn in the world at 1x, then removed.
    await page.evaluate(() => {
      const gs = window.game.scene.getScene('Game');
      const g = gs.add.graphics().setDepth(9500);
      [[0x40e0ff, 0], [0xffa030, 1]].forEach(([c, i]) => {
        const pts = window.__log.trails[i];
        g.lineStyle(3, c, 0.9);
        g.beginPath();
        pts.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.strokePath();
      });
      window.__trailGfx = g;
    });
    await shoot('08-trails');
    await page.evaluate(() => window.__trailGfx.destroy());
    await page.waitForTimeout(2500);
    await shoot('09-mixed-fight');
    // Flank: close lateral footwork along the front, then a dash round it.
    await page.evaluate(async () => {
      const gs = window.game.scene.getScene('Game');
      const p = gs.player, g = window.__gate;
      const dx = g.x - p.x, dy = g.y - p.y, d = Math.hypot(dx, dy) || 1;
      window.__plant = false;
      const t0 = Date.now();
      while (Date.now() - t0 < 600) { p.setMoveInput({ x: -dy / d, y: dx / d, force: 1 }); await new Promise((r) => setTimeout(r, 30)); }
      p.tryDash();
    });
    await page.waitForTimeout(260);
    await shoot('10-flank');
  } else if (run.script === 'breach') {
    await at('window.__log.shields.length >= 2');
    await shoot('01-pair-present');
    await page.evaluate(() => window.__log.shields[0].die());
    await at(released, 3000);
    await shoot('02-shield-killed-release');
    await page.waitForTimeout(900);
    await shoot('03-backline-entering');
  } else if (run.script === 'kite') {
    await until('window.__log.shields.length >= 2');
    // Hold the player 620px behind the front's midpoint for as long as it holds.
    await page.evaluate(() => {
      window.__plant = false;
      window.__kite = setInterval(() => {
        const gs = window.game.scene.getScene('Game');
        const [a, b] = window.__log.shields;
        if (!a?.alive || !b?.alive) return;
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const p = gs.player, dx = p.x - mx, dy = p.y - my, d = Math.hypot(dx, dy) || 1;
        if (d < 620) p.setPosition(mx + dx / d * 620, my + dy / d * 620);
      }, 30);
    });
    await page.waitForTimeout(1500);
    await shoot('01-kiting-front-holding');
    await at(released, 12000);
    await shoot('02-timeout-release');
    await page.evaluate(() => clearInterval(window.__kite));
  }
  await page.close();
}

await browser.close();
console.log(`frames in ${OUT}`);
