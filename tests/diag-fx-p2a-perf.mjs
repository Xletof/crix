// DIAGNOSTIC — P2-A BLASTER FIRE & IMPACT: what it costs. Prints numbers,
// asserts nothing.
//
//   node tests/diag-fx-p2a-perf.mjs [--reps=5] [--ticks=600]
//
// THESE ARE HEADLESS CHROMIUM NUMBERS ON A SOFTWARE RASTERISER. They compare A
// (`visualPilot=v2c&polish=p1`) with B (A + `fxPilot=p2a`) on the same box
// and say nothing about a phone's absolute frame time.
//   1. ONE-TIME COST: painting the twelve p2a-* textures (median of N), in ms;
//      their resident bytes and the whole texture list A vs B.
//   2. DISPLAY OBJECTS: the Game scene's display list at rest, and its peak in
//      a heavy staged fight (a dense crowd, pistol then rifle fire every 3
//      ticks — far above a thumb's rate — into cover and bodies).
//   3. PER-FRAME COST: median / p95 wall time of a rendered `game.step` over
//      that fight, A vs B; the time inside the P2-A frame hook alone; live
//      tracers / flashes / contacts / spark streaks at the peak.
//   4. PARTICLES: the shipped emitters' live particle count at the peak (B's
//      replaced emissions go to invisible twins and are killed at once).
//   5. TWEENS: live tween count at the end (P2-A uses none).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { CHROME, bootPage } from './diag-stuck-audit.mjs';

const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const REPS = +opt('reps', '5'), TICKS = +opt('ticks', '600');
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const out = {};
for (const [cfg, flags] of [['A', 'visualPilot=v2c&polish=p1'], ['B', 'visualPilot=v2c&polish=p1&fxPilot=p2a']]) {
  const p = await bootPage(browser, { flags, baseline: null, q: 'room=hangar', seed: 4242 });
  out[cfg] = await p.evaluate(async ({ reps, ticks }) => {
    const gs = window.__gs, g = window.game;
    const paint = await window.__mod(/systems\/p2aPaint\.js/);
    const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
    const p95 = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length * 0.95)]; };
    const r = {};
    const c = gs._p2a;
    const KEYS = Object.keys(g.textures.list).filter((k) => k.startsWith('p2a-'));
    if (c) {
      const t = [];
      for (let i = 0; i < reps; i++) {
        for (const k of KEYS) g.textures.remove(k);
        const t0 = performance.now(); paint.paintFxP2A(gs); t.push(performance.now() - t0);
      }
      r.paintMs = med(t);
      for (const o of [...c.imgPool, c.heatGlow]) o.setTexture(o.texture.key);
      let b = 0; for (const k of KEYS) { const s = g.textures.get(k).getSourceImage(); b += s.width * s.height * 4; }
      r.p2aBytes = b; r.p2aTextures = KEYS.length;
    }
    let bytes = 0, n = 0;
    for (const k of Object.keys(g.textures.list)) { if (k.startsWith('__')) continue; const s = g.textures.get(k).getSourceImage(); if (s?.width) { bytes += s.width * s.height * 4; n++; } }
    r.texBytes = bytes; r.texCount = n;
    gs.arenaActive = false; gs._spawnQueue = [];
    gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
    window.__adv(5);
    r.listAtRest = gs.children.list.length;
    // the heavy fight
    const P = gs.player; P.x = 800; P.y = 700; P.body.reset(800, 700);
    gs._spawnSwarmlingPack(980, 560); gs._spawnSwarmlingPack(700, 900); gs._spawnSwarmlingPack(1040, 860);
    for (const [t, x, y] of [['grunt', 1000, 700], ['grunt', 860, 860], ['shooter', 1120, 560], ['shooter', 1180, 760], ['sniper', 1240, 900], ['shielded', 1000, 900], ['bomber', 1100, 420], ['grunt', 600, 760]]) gs.spawnEnemyAt(t, x, y, {});
    window.__seed(77); window.__headless = false;
    let hook = 0, peakList = 0, peak = { bolts: 0, flashes: 0, impacts: 0, sparks: 0 }, peakParticles = 0;
    if (c) { const u = c.update.bind(c); c.update = (t, d) => { const t0 = performance.now(); u(t, d); hook += performance.now() - t0; }; }
    const emitters = gs.children.list.filter((o) => o.type === 'ParticleEmitter' && o.visible);
    const step = [];
    for (let i = 0; i < ticks; i++) {
      if (i === ticks / 2) { P.secondary = 'rifle'; P.secondaryAmmo = 999; }
      if (i % 3 === 0) { P.fireCooldown = 0; P.ammo = 99; P.keyboardFire(); }
      if (i % 40 === 0) { P.fireCooldown = 0; P.tryFire(-Math.PI / 2 + 0.3); }           // into the cover to the north
      if (i % 90 === 0 && gs.enemies.countActive() < 8) gs._spawnSwarmlingPack(1000, 600 + (i % 180));
      const t0 = performance.now(); window.__adv(1); step.push(performance.now() - t0);
      peakList = Math.max(peakList, gs.children.list.length);
      peakParticles = Math.max(peakParticles, emitters.reduce((s, e) => s + (e.alive?.length || 0), 0));
      if (c) {
        peak.bolts = Math.max(peak.bolts, c.bolts.length); peak.flashes = Math.max(peak.flashes, c.flashes.length);
        peak.impacts = Math.max(peak.impacts, c.impacts.length);
        peak.sparks = Math.max(peak.sparks, c.impacts.reduce((s, m) => s + (m.sparks?.length || 0), 0));
      }
    }
    r.stepMed = med(step); r.stepP95 = p95(step); r.peakDisplayList = peakList; r.peakShippedParticles = peakParticles;
    if (c) {
      r.hookMsPerFrame = hook / ticks;
      r.peakTracers = peak.bolts; r.peakFlashes = peak.flashes; r.peakContacts = peak.impacts; r.peakSparkStreaks = peak.sparks;
      r.pooledObjects = c.imgPool.length + c.gfxPool.length + c.bolts.length * 3 + c.flashes.length * 2 + c.impacts.length * 4;
      r.tracersDrawn = c.stats.bolts; r.contactsDrawn = Object.values(c.stats.impacts).reduce((a, b) => a + b, 0); r.parityParticles = c.stats.parity; r.contactsRecycled = c.stats.recycled;
    }
    r.tweens = gs.tweens.getTweens().length;
    r.listInFight = gs.children.list.length;
    return r;
  }, { reps: REPS, ticks: TICKS });
  await p.close();
}
await browser.close();
const f = (v) => (typeof v === 'number' ? (Number.isInteger(v) ? v : v.toFixed(3)) : v);
console.log('metric'.padEnd(22), 'A (P1)'.padStart(14), 'B (P1 + P2-A)'.padStart(14));
for (const k of [...new Set([...Object.keys(out.A), ...Object.keys(out.B)])]) console.log(k.padEnd(22), String(f(out.A[k] ?? '—')).padStart(14), String(f(out.B[k] ?? '—')).padStart(14));
