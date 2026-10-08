// DIAGNOSTIC (prints numbers, asserts nothing): HOW MUCH THE WARNING CHANGES
// THE SCREEN, legacy whole-body tint vs the v1 payload warning, at 1x.
//
// One body, staged on open floor at each proximity (t = 1 - dist/300, the
// frozen telegraph's own number), photographed at the pulse PEAK and at the
// pulse TROUGH, each compared with the same body far away (t = 0, the resting
// state). The frame is the real game render: the real AI ticked once at that
// distance with its pulse phased to land on the peak, so the legacy tint and
// the v1 payload both come from `_tickSwarm`'s own numbers.
//   area   pixels whose colour moved by more than 48 (sum of |dR|+|dG|+|dB|)
//   energy sum over those pixels of the luminance change (0-255 units / 1000)
//   pulse  the same two numbers between peak and trough: what BLINKS
//
// usage: node tests/diag-demolisher-warning.mjs [--base=URL] [--elite] [--facing=front|side|back]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const BASE = opt('base', 'http://localhost:5173/');
const ELITE = process.argv.includes('--elite');
const FACING = opt('facing', 'front');
const TS = [0.15, 0.3, 0.45, 0.6, 0.75, 0.84];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });

async function measure(flags) {
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  page.on('pageerror', (e) => { console.error(e.message); process.exit(1); });
  await page.goto(`${BASE}?nodlg=1&nofreeze=1${flags}&encdbg=1&room=hangar&sector=1`);
  await page.waitForFunction(() => window.game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 45000 });
  await page.evaluate(async ([ELITE, FACING]) => {
    const g = window.game; g.loop.sleep();
    let s = 12345; Math.random = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    window.__t = 1e5; Date.now = () => window.__t;
    const adv = (window.__adv = (n = 1) => { for (let i = 0; i < n; i++) { window.__t += 1000 / 60; g.step(window.__t, 1000 / 60); } });
    g.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 4242 }); adv(2);
    const url = performance.getEntriesByType('resource').map((r) => r.name).find((n) => /systems\/debug\.js/.test(n));
    (await import(url)).setGodMode(true);
    const gs = (window.__gs = g.scene.getScene('Game'));
    for (let i = 0; i < 300 && !gs.roomSpec; i++) adv(1);
    adv(20);
    gs.arenaActive = false; gs._roomModifier = null;
    for (const e of gs.enemies.getChildren().slice()) gs._destroyEnemyFully(e);
    gs.cameraDirector.update = () => {};
    g.scene.getScene('HUD')?.scene.setVisible(false);
    const P = gs.player; P.setVisible(false); P.weaponSprite?.setVisible(false);
    const e = (window.__e = gs.spawnEnemyAt('bomber', 820, 700, ELITE ? { elite: true } : {}));
    e.cfg = { ...e.cfg, speed: 0 };                 // staged: the AI ticks, the body stays put
    const dir = FACING === 'front' ? Math.PI / 2 : FACING === 'back' ? -Math.PI / 2 : 0;
    // stage proximity t at the pulse peak (ph = +1) or trough (ph = -1)
    window.__stage = (t, ph) => {
      const d = (1 - t) * 300;
      P.setPosition(820 + Math.cos(dir) * Math.max(d, 60), 700 + Math.sin(dir) * Math.max(d, 60)); P.body.reset(P.x, P.y);
      const tt = Math.max(0, 1 - Math.max(d, 60) / 300);
      // two ticks: the first turns him (presentation draws BEFORE the AI), the
      // second draws the facing; the AI's own two advances land the pulse on the peak
      e._bombPulse = ph * Math.PI / 2 - 2 * (1000 / 60) * (0.006 + tt * 0.03);
      e._fireAnimTimer = 0;
      adv(2);
      gs.cameras.main.setScroll(820 - 360, 700 - 500); gs.cameras.main.resetFX(); gs._sectorTint?.setAlpha(0);
      g.renderer.preRender(); g.scene.render(g.renderer); g.renderer.postRender();
      const cam = gs.cameras.main, wv = cam.worldView;
      return { x: Math.round(820 - 70 - wv.x + cam.x), y: Math.round(700 - 75 - wv.y + cam.y), t: tt };
    };
  }, [ELITE, FACING]);
  const dec = await browser.newPage();
  const shot = async (t, ph) => {
    const pos = await page.evaluate(([t, ph]) => window.__stage(t, ph), [t, ph]);
    const buf = await page.screenshot({ clip: { x: pos.x, y: pos.y, width: 140, height: 150 } });
    return { t: pos.t, d: await dec.evaluate(async (src) => { const i = new Image(); i.src = src; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d'); x.drawImage(i, 0, 0); return Array.from(x.getImageData(0, 0, c.width, c.height).data); }, `data:image/png;base64,${buf.toString('base64')}`) };
  };
  const diff = (a, b) => {
    let area = 0, energy = 0;
    for (let o = 0; o < a.length; o += 4) {
      const dd = Math.abs(a[o] - b[o]) + Math.abs(a[o + 1] - b[o + 1]) + Math.abs(a[o + 2] - b[o + 2]);
      if (dd > 48) { area++; energy += Math.abs((0.2126 * a[o] + 0.7152 * a[o + 1] + 0.0722 * a[o + 2]) - (0.2126 * b[o] + 0.7152 * b[o + 1] + 0.0722 * b[o + 2])); }
    }
    return { area, energy: Math.round(energy / 1000) };
  };
  const rest = (await shot(0, 1)).d;
  const rows = [];
  for (const t of TS) {
    const pk = await shot(t, 1), tr = await shot(t, -1);
    rows.push({ t: +pk.t.toFixed(2), peak: diff(pk.d, rest), trough: diff(tr.d, rest), pulse: diff(pk.d, tr.d) });
  }
  await page.close(); await dec.close();
  return rows;
}

const L = await measure(''), V = await measure('&roster=v1&gait=v2');
console.log(`${BASE} — ${ELITE ? 'ELITE' : 'REGULAR'}, facing ${FACING}; screen change against the resting body (t=0), 140x150 px around it`);
console.log('   t    | LEGACY peak area/energy  trough  pulse | V1 peak area/energy  trough  pulse');
for (let i = 0; i < TS.length; i++) {
  const a = L[i], b = V[i];
  const f = (r) => `${String(r.area).padStart(4)}/${String(r.energy).padStart(3)}`;
  console.log(`  ${a.t.toFixed(2)}  |  ${f(a.peak)}  ${f(a.trough)}  ${f(a.pulse)}  |  ${f(b.peak)}  ${f(b.trough)}  ${f(b.pulse)}`);
}
await browser.close();
