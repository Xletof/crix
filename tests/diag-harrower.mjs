// THE HARROWER — Phase B.1 concept-gate diagnostic. Print-only.
//
// It measures BEHAVIOUR, never taste. There is no check here saying "a Champion
// should be fast" — that is a design property masquerading as an invariant, and
// pinning one of those in a green test is exactly how the rejected Interdictor's
// speed error survived to the handset.
//
// The one thing it does judge is the rejected candidate's signature failure:
// **no accidental Interdictor state.** Outside its bounded bank, the Harrower
// must never settle into a long stationary standoff.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ROOMS = process.argv[2] ? [process.argv[2]] : ['hangar', 'detention', 'corridor'];
const WINDOW_MS = 42000;

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
});

const results = [];
for (const room of ROOMS) {
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  page.on('pageerror', (e) => { console.error(`PAGE ERROR (${room}):`, String(e).split('\n')[0]); });
  await page.goto(`http://localhost:5173/?nodlg=1&champdbg=1&encdbg=crossfire&room=${room}&sector=6`);
  await page.waitForTimeout(4500);
  await page.mouse.click(360, 640);
  await page.waitForTimeout(800);
  await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 7373 }));
  await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
  await page.waitForTimeout(1800);

  // Sampled from INSIDE the page on a postupdate hook. Polling from the harness
  // costs 200-400ms a round trip and would miss most of a 260ms decel.
  await page.evaluate(async () => {
    const { setGodMode } = await import('/src/systems/debug.js');
    setGodMode(true);                       // the instrument must not die mid-measurement
    const gs = window.game.scene.getScene('Game');
    if (!gs.enemies.getChildren().some((e) => e.alive && e.isChampion)) {
      gs.spawnChampion(gs.player.x + 420, gs.player.y);
    }
    const S = {
      ms: 0, frames: 0, moving: 0, atPass: 0, bank: 0, still: 0,
      stillRun: 0, worstStill: 0, worstStillState: null, worstStillStagger: 0,
      states: {}, passes: [], passStart: null, passDist: 0,
      wakeLen: 0, wakeLenMax: 0, wakePts: 0, wakePtsMax: 0, wakeFrames: 0,
      onScreen: 0, passFrames: 0, hazards: 0, hazardsMax: 0, err: 0,
    };
    window.__S = S;
    gs.events.on('postupdate', () => {
      const h = gs.enemies.getChildren().find((e) => e.alive && e.isChampion);
      const d = gs.game.loop.delta;
      S.ms += d; S.frames++;
      S.hazards = gs._hazards.length;
      S.hazardsMax = Math.max(S.hazardsMax, S.hazards);
      if (!h) return;
      const v = Math.hypot(h.body.velocity.x, h.body.velocity.y);
      const st = h._hrw;
      S.states[st] = (S.states[st] || 0) + d;
      // UNINTENDED stillness only. The bank is a bounded, designed stop — the
      // vulnerability window the whole loop is built around — and counting it
      // made the first run report a 1037ms "stall" that was the 850ms bank
      // bleeding into the first frames of ALIGN. The instrument was wrong, not
      // the game, which is this project's most reliable rule about a surprising
      // measurement. A run is reset by any bank or decel frame, so what is left
      // is standing still when it should be repositioning.
      const intended = st === 'bank' || st === 'decel';
      if (v > 20) { S.moving += d; S.stillRun = 0; }
      else {
        S.still += d;
        if (intended) { S.stillRun = 0; }
        else {
          S.stillRun += d;
          if (S.stillRun > S.worstStill) {
            S.worstStill = S.stillRun; S.worstStillState = st;
            S.worstStillStagger = Math.round(h._staggerMs || 0);
          }
        }
      }
      if (v >= 500) S.atPass += d;
      if (st === 'bank') S.bank += d;

      // Pass distance, measured as real travel between PASS entry and exit.
      if (st === 'pass') {
        if (!S.passStart) { S.passStart = { x: h.x, y: h.y }; S.passDist = 0; }
        S.passDist += v * (d / 1000);
        S.passFrames++;
        // Is the craft inside the camera's visible band? The game camera is
        // inset by the HUD top bar and the touch controls cover the bottom, so
        // "in the viewport" is not "in the picture the fight happens in".
        const cam = gs.cameras.main;
        const sx = (h.x - cam.scrollX) * cam.zoom;
        const sy = (h.y - cam.scrollY) * cam.zoom;
        if (sx > -60 && sx < cam.width + 60 && sy > -60 && sy < cam.height + 60) S.onScreen += 1;
      } else if (S.passStart) {
        S.passes.push(Math.round(S.passDist));
        S.passStart = null;
      }

      if (h.wake && !h.wake.dead && h.wake.points.length > 1) {
        S.wakeFrames++;
        const L = h.wake.length;
        S.wakeLen += L; S.wakeLenMax = Math.max(S.wakeLenMax, L);
        S.wakePts += h.wake.points.length;
        S.wakePtsMax = Math.max(S.wakePtsMax, h.wake.points.length);
      }
    });
  });

  await page.waitForTimeout(WINDOW_MS);

  const out = await page.evaluate(async () => {
    const gs = window.game.scene.getScene('Game');
    const S = window.__S;
    const h = gs.enemies.getChildren().find((e) => e.alive && e.isChampion);
    const body = h ? { r: h.body.radius, w: h.width, hh: h.height, hp: h.hpMax } : null;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));

    // CLEANUP — death, then a room change. Both must leave nothing behind.
    const beforeDeath = gs._hazards.length;
    h?.damage(999999);
    await wait(260);
    const afterDeath = gs._hazards.length;

    const { ROOMS } = await import('/src/data/rooms.js');
    gs.loadRoom(ROOMS.find((r) => r.id === 'hangar'));
    await wait(1000);
    const afterRoom = gs._hazards.length;

    return { ...S, states: { ...S.states }, passes: [...S.passes],
      body, beforeDeath, afterDeath, afterRoom };
  });
  results.push({ room, ...out });
  await page.close();
}
await browser.close();

const pct = (n, d) => `${(100 * n / (d || 1)).toFixed(0)}%`;
console.log('\n══ THE HARROWER — PHASE B.1 CONCEPT GATE ══════════════════════════════');
for (const r of results) {
  const secs = r.ms / 1000;
  const passes = r.passes.filter((p) => p > 40);
  const avg = passes.length ? Math.round(passes.reduce((a, b) => a + b, 0) / passes.length) : 0;
  console.log(`\n  ── ${r.room.toUpperCase()} — ${secs.toFixed(0)}s, ${r.frames} frames`);
  console.log(`     body                Ø${r.body?.r * 2} under ${r.body?.w}x${r.body?.hh}px, hp ${r.body?.hp}`);
  console.log(`     MOVING              ${pct(r.moving, r.ms)}   still ${pct(r.still, r.ms)}`);
  console.log(`     at pass speed       ${pct(r.atPass, r.ms)}`);
  console.log(`     bank / recovery     ${pct(r.bank, r.ms)}`);
  console.log(`     longest UNINTENDED  ${Math.round(r.worstStill)}ms still  (state: ${r.worstStillState ?? '—'})`);
  console.log(`       stagger at that moment ${r.worstStillStagger}ms   (bank/decel excluded — see the note in this file)`);
  const st = Object.entries(r.states).map(([k, v]) => `${k} ${pct(v, r.ms)}`).join('  ');
  console.log(`     state split         ${st}`);
  console.log(`     passes completed    ${passes.length}   distances ${passes.join(', ') || '—'}`);
  console.log(`     mean pass distance  ${avg}px`);
  console.log(`     pass on screen      ${pct(r.onScreen, r.passFrames)} of pass frames`);
  console.log(`     wake length         mean ${Math.round(r.wakeLen / (r.wakeFrames || 1))}px  max ${Math.round(r.wakeLenMax)}px`);
  console.log(`     wake segments       mean ${Math.round(r.wakePts / (r.wakeFrames || 1))}  max ${r.wakePtsMax}  (cap 64)`);
  console.log(`     live hazard objects max ${r.hazardsMax}`);
  console.log(`     cleanup             death ${r.beforeDeath}->${r.afterDeath}   room change -> ${r.afterRoom}`);
}
console.log('');
