// DIAGNOSTIC — VISUAL IDENTITY V2: what the pilot costs. Prints numbers,
// asserts nothing.
//
//   node tests/diag-visual-pilot-perf.mjs [--reps=5] [--ticks=600]
//
// THESE ARE HEADLESS CHROMIUM NUMBERS ON A SOFTWARE RASTERISER. They compare A
// with B on the same box and say nothing about a phone's absolute frame time.
//   1. ONE-TIME COST: painting the Hangar backdrop (the stock painter vs the
//      pilot's painter, same room options, median of N), in ms.
//   2. RESIDENT TEXTURE MEMORY: the sum of every texture's width x height x 4,
//      R1 vs V2 vs V2B (A / B / C).
//   3. PER-FRAME COST: the scene graph does not change — the pilot adds no
//      display object at runtime — so this is the control: median / p95 wall
//      time of a rendered `game.step` over the same staged fight, A vs B, and
//      the display-list size.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { CHROME, bootPage } from './diag-stuck-audit.mjs';

const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const REPS = +opt('reps', '5'), TICKS = +opt('ticks', '600');
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const out = {};
for (const [cfg, flags] of [['A', ''], ['B', 'visualPilot=v2'], ['C', 'visualPilot=v2b']]) {
  const p = await bootPage(browser, { flags, baseline: null, q: 'room=hangar', seed: 4242 });
  out[cfg] = await p.evaluate(async ({ reps, ticks }) => {
    const gs = window.__gs;
    const rooms = (await window.__mod(/data\/rooms\.js/)).ROOMS;
    const px = await window.__mod(/systems\/pixelArt\.js/);
    const vh = await window.__mod(/systems\/vpHangar\.js/);
    const mu = await window.__mod(/data\/mapUtils\.js/);
    const dbg = await window.__mod(/systems\/debug\.js/);
    const spec = rooms.find((r) => r.id === 'hangar');
    const opts = { ...spec.floor, perimeter: spec.perimeter, openings: mu.perimeterOpenings(spec), grounding: [] };
    const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
    const paint = [];
    for (let i = 0; i < reps; i++) {
      const key = `perf-bg-${i}`;
      const t0 = performance.now();
      if (dbg.isVisualPilotV2?.()) vh.paintPilotHangarBackdrop(gs, key, 1600, 1400, opts, spec, dbg.getVisualPilot());
      else px.paintBackdrop(gs, key, 1600, 1400, opts);
      paint.push(performance.now() - t0);
      window.game.textures.remove(key);
    }
    let bytes = 0, n = 0;
    for (const k of Object.keys(window.game.textures.list)) {
      if (k.startsWith('__')) continue;
      const src = window.game.textures.get(k).getSourceImage();
      if (src?.width) { bytes += src.width * src.height * 4; n++; }
    }
    // the staged fight, rendered
    gs.arenaActive = false;
    gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
    gs._spawnSwarmlingPack(820, 560); gs._spawnSwarmlingPack(700, 900);
    for (const [t, x, y] of [['grunt', 900, 700], ['grunt', 860, 860], ['shooter', 1120, 560], ['sniper', 1240, 900], ['shielded', 1000, 900], ['bomber', 1100, 420]]) gs.spawnEnemyAt(t, x, y, {});
    window.__seed(77); window.__headless = false;
    const step = [];
    for (let i = 0; i < ticks; i++) {
      if (i % 9 === 0) gs.player.keyboardFire();
      const t0 = performance.now(); window.__adv(1); step.push(performance.now() - t0);
    }
    const s = [...step].sort((x, y) => x - y);
    return {
      paintMs: +med(paint).toFixed(1), paintAll: paint.map((x) => +x.toFixed(1)),
      texMB: +(bytes / 1048576).toFixed(2), textures: n,
      stepMedMs: +med(step).toFixed(2), stepP95Ms: +s[Math.floor(s.length * 0.95)].toFixed(2),
      displayList: gs.children.list.length,
    };
  }, { reps: REPS, ticks: TICKS });
  await p.close();
  console.log(cfg, JSON.stringify(out[cfg]));
}
await browser.close();
const L = { A: 'R1', B: 'V2', C: 'V2B' };
console.log('\n' + ['A', 'B', 'C'].map((c) => `${L[c]}: Hangar paint ${out[c].paintMs} ms | textures ${out[c].texMB} MB (${out[c].textures}) | rendered step median ${out[c].stepMedMs} / p95 ${out[c].stepP95Ms} ms | display list ${out[c].displayList}`).join('\n'));
