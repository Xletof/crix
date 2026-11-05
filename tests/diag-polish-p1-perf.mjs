// DIAGNOSTIC — P1 COMBAT VISUAL POLISH: what it costs. Prints numbers, asserts
// nothing.
//
//   node tests/diag-polish-p1-perf.mjs [--reps=5] [--ticks=600]
//
// THESE ARE HEADLESS CHROMIUM NUMBERS ON A SOFTWARE RASTERISER. They compare A
// (`visualPilot=v2c`) with B (`visualPilot=v2c&polish=p1`) on the same box and
// say nothing about a phone's absolute frame time.
//   1. ONE-TIME COST: painting the five p1-* textures (median of N), in ms.
//   2. RESIDENT TEXTURE MEMORY: the p1 set, and the whole texture list A vs B.
//   3. DISPLAY OBJECTS: the Game scene's display list A vs B at rest.
//   4. PER-FRAME COST: median / p95 wall time of a rendered `game.step` over the
//      same staged fight with a READY Super (the indicator's busiest state) and
//      a banner every 2s, A vs B; and the time spent inside the P1 hook alone.
//   5. BANNER LAYOUT: wall time of one `showBanner` call (measure + fit), A vs B,
//      over the longest strings; Text re-renders per call.
//   6. TWEENS: live tween count at the end of the fight (no growth).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { CHROME, bootPage } from './diag-stuck-audit.mjs';

const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const REPS = +opt('reps', '5'), TICKS = +opt('ticks', '600');
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const out = {};
for (const [cfg, flags] of [['A', 'visualPilot=v2c'], ['B', 'visualPilot=v2c&polish=p1']]) {
  const p = await bootPage(browser, { flags, baseline: null, q: 'room=hangar', seed: 4242 });
  out[cfg] = await p.evaluate(async ({ reps, ticks }) => {
    const gs = window.__gs, g = window.game, hud = g.scene.getScene('HUD');
    const p1 = await window.__mod(/systems\/p1Paint\.js/);
    const dbg = await window.__mod(/systems\/debug\.js/);
    const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
    const p95 = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length * 0.95)]; };
    const r = {};
    // 1. paint (B only: remove and repaint the set)
    if (dbg.isPolishP1()) {
      const paint = [];
      for (let i = 0; i < reps; i++) {
        for (const k of ['p1-pistol', 'p1-pistol-hot', 'p1-rifle', 'p1-rifle-hot', 'p1-blade']) g.textures.remove(k);
        const t0 = performance.now(); p1.paintPolishP1(gs); paint.push(performance.now() - t0);
      }
      r.paintMs = med(paint);
      // the weapon Image still points at the frames of the textures just
      // replaced: re-bind it to the fresh ones before anything renders
      const w = gs._p1Player?.weapon; if (w) { const k = w.texture.key; w.setTexture(k); }
      let b = 0; for (const k of ['p1-pistol', 'p1-pistol-hot', 'p1-rifle', 'p1-rifle-hot', 'p1-blade']) { const s = g.textures.get(k).getSourceImage(); b += s.width * s.height * 4; }
      r.p1Bytes = b;
    }
    let bytes = 0, n = 0;
    for (const k of Object.keys(g.textures.list)) { if (k.startsWith('__')) continue; const s = g.textures.get(k).getSourceImage(); if (s?.width) { bytes += s.width * s.height * 4; n++; } }
    r.texBytes = bytes; r.texCount = n;
    // 3. display list at rest
    gs.arenaActive = false; gs._spawnQueue = [];
    gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
    window.__adv(5);
    r.listAtRest = gs.children.list.length; r.hudList = hud.children.list.length;
    // 4. the fight, rendered, Super ready throughout
    gs._spawnSwarmlingPack(820, 560); gs._spawnSwarmlingPack(700, 900);
    for (const [t, x, y] of [['grunt', 900, 700], ['grunt', 860, 860], ['shooter', 1120, 560], ['sniper', 1240, 900], ['shielded', 1000, 900], ['bomber', 1100, 420]]) gs.spawnEnemyAt(t, x, y, {});
    window.__seed(77); window.__headless = false;
    let hook = 0;
    const c = gs._p1Player;
    if (c) { const u = c.update.bind(c); c.update = (t, d) => { const t0 = performance.now(); u(t, d); hook += performance.now() - t0; }; }
    const step = [];
    for (let i = 0; i < ticks; i++) {
      gs.player.superCharge = 99;
      if (i % 9 === 0) gs.player.keyboardFire();
      if (i % 120 === 0) gs.events.emit('show-banner', i % 240 ? 'SLICE TERMINALS FOR SUPPORT' : 'FRENZY', '#ffd040');
      const t0 = performance.now(); window.__adv(1); step.push(performance.now() - t0);
    }
    r.stepMed = med(step); r.stepP95 = p95(step); r.hookMsPerFrame = hook / ticks;
    r.tweens = gs.tweens.getTweens().length + hud.tweens.getTweens().length;
    r.listInFight = gs.children.list.length;
    // 5. banner layout
    const strs = ['SUPPORT: SHIELD CHARGED & BACTA VIAL', 'ARENA SURVIVED — FINISH THEM!', 'SLICE TERMINALS FOR SUPPORT', 'CHAMBER CLEAR', 'WAVE 3'];
    const lay = [];
    for (let k = 0; k < reps * 4; k++) for (const s of strs) { const t0 = performance.now(); hud.showBanner(s, '#fff'); lay.push(performance.now() - t0); }
    r.bannerCallMs = med(lay); r.bannerCallP95 = p95(lay);
    return r;
  }, { reps: REPS, ticks: TICKS });
  await p.close();
}
await browser.close();
const f = (v) => (typeof v === 'number' ? (Number.isInteger(v) ? v : v.toFixed(3)) : v);
console.log('metric'.padEnd(22), 'A (v2c)'.padStart(14), 'B (v2c + p1)'.padStart(14));
for (const k of [...new Set([...Object.keys(out.A), ...Object.keys(out.B)])]) console.log(k.padEnd(22), String(f(out.A[k] ?? '—')).padStart(14), String(f(out.B[k] ?? '—')).padStart(14));
