// DIAGNOSTIC (prints numbers, asserts nothing): how much of the Bulwark field
// a player can SEE at each compass facing, and how strong the material is per
// visible pixel. The same bearer, alone on the escort floor, is photographed
// with its field and again with the field's five Graphics hidden; the pixels
// that differ ARE the field as composited (body occlusion included).
//
//   px     visible field pixels
//   dL     mean |luminance change| over those pixels   — material strength
//   sum    px x dL                                     — total presence
//   rimL   mean luminance of the brightest 10% of them  — the edge
//
// The first build dimmed the FAR layers, so dL fell with the facing (south 1.0,
// north well under half). Body occlusion and the band's projection change `px`
// legitimately; `dL` and `rimL` should not move.
//
// usage: node tests/diag-bulwark-orient.mjs [--base=URL] [--xsec='{"inR":9,"inH":2}'] [--elite] [--nobody] [--events]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const BASE = opt('base', 'http://localhost:5173/');
const XSEC = JSON.parse(opt('xsec', 'null'));
const ELITE = process.argv.includes('--elite');
const NOBODY = process.argv.includes('--nobody');   // hide the bearer: projection alone, no occlusion
// --events: measure each REACTION instead of the idle field — the frame with
// the event against the same facing's idle frame, so only the reaction counts
const EVENTS = process.argv.includes('--events');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
page.on('pageerror', (e) => { console.error(e.message); process.exit(1); });
await page.goto(`${BASE}?nodlg=1&nofreeze=1&roster=v1&gait=v2&move=v22&encdbg=1&room=detention&sector=1`);
await page.waitForFunction(() => window.game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 45000 });
const camY = await page.evaluate(async ({ XSEC, ELITE, NOBODY, EVENTS }) => {
  const g = window.game; g.loop.sleep();
  let s = 12345; Math.random = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  window.__t = 1e5; Date.now = () => window.__t;
  window.__adv = (n = 1) => { for (let i = 0; i < n; i++) { window.__t += 1000 / 60; g.step(window.__t, 1000 / 60); } };
  g.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 4242 }); window.__adv(2);
  const gs = (window.__gs = g.scene.getScene('Game'));
  for (let i = 0; i < 300 && !gs.roomSpec; i++) window.__adv(1);
  window.__adv(20);
  if (XSEC) {
    // the SAME module instance the game holds: resolve its URL from the loaded resources
    const url = performance.getEntriesByType('resource').map((r) => r.name).find((n) => /systems\/bulwarkCurtain\.js/.test(n));
    Object.assign((await import(url)).CURTAIN, XSEC);
  }
  gs.arenaActive = false; gs._roomModifier = null;
  for (const e of gs.enemies.getChildren().slice()) gs._destroyEnemyFully(e);
  for (const o of gs.roomLayer.getChildren()) { if ((o.displayWidth || 0) >= 1000) continue; o.setVisible(false); if (o.body) o.body.enable = false; }
  for (const t of gs.terminals || []) { for (const k of Object.values(t)) if (k?.setVisible) k.setVisible(false); t.setVisible?.(false); }
  for (const o of gs.children.list) if (o.type === 'Text') o.setVisible(false);
  for (const q of gs.envLight?.parts || []) (q.img || q.image || q)?.setVisible?.(false);
  gs.cameraDirector.update = () => {};
  const hud = g.scene.getScene('HUD'); if (hud) hud.scene.setVisible(false);
  const P = gs.player; P.setPosition(900, 1500); P.body.reset(P.x, P.y); P.setVisible(false); P.weaponSprite?.setVisible(false);
  gs.cameras.main.setScroll(700 - 360, 600 - 400);
  const e = (window.__e = gs.spawnEnemyAt('shielded', 700, 600, ELITE ? { elite: true } : {}));
  e.body.reset(700, 600);
  window.__set = (a, field) => {
    e._performing = true; e._movePlanted = true; e._aim = a; e._shieldFacing = a; e.setVelocity(0, 0); e.body.reset(700, 600);
    window.__adv(2);
    const f = e._curtain; for (const gg of [f.near, f.far, f.farW, f.glowNear, f.glowFar, f.glowFarW, f.coreG].filter(Boolean)) gg.setVisible(field);
    e.threatRing?.setVisible(false); e.shadow?.setVisible?.(false);
    if (NOBODY) { e.setAlpha(0); e.weaponSprite?.setVisible(false); }
    gs.cameras.main.resetFX(); gs._sectorTint?.setAlpha(0);
    window.__adv(1);                     // render the frame the visibility change belongs to
  };
  window.__set(Math.PI / 2, true); window.__adv(90);   // let the room's own fades settle first
  // a reaction held at one age: the field's own tick is parked and the frame is
  // drawn by hand, so every facing photographs exactly the same state
  window.__ev = (a, events) => {
    window.__set(a, true);
    const f = e._curtain; f.tick = () => false;
    f.events = events.map((v) => ({ ...v })); f.clock = 1234; f.coreKick = 0; f.corePulse = 0; f.draw();
    window.__adv(1);
  };
  return gs.cameras.main.y;
}, { XSEC, ELITE, NOBODY, EVENTS });
const comp = await browser.newPage();
const lum = async (a, b) => comp.evaluate(async ([a, b]) => {
  const load = async (s) => { const i = new Image(); i.src = s; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d'); x.drawImage(i, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
  const A = await load(a), B = await load(b), d = [], hi = [];
  for (let i = 0; i < A.length; i += 4) {
    const la = 0.2126 * A[i] + 0.7152 * A[i + 1] + 0.0722 * A[i + 2], lb = 0.2126 * B[i] + 0.7152 * B[i + 1] + 0.0722 * B[i + 2];
    if (Math.abs(la - lb) > 3) { d.push(Math.abs(la - lb)); hi.push(la); }
  }
  hi.sort((p, q) => q - p);
  const top = hi.slice(0, Math.max(1, Math.round(hi.length * 0.1)));
  return { px: d.length, dL: d.reduce((p, q) => p + q, 0) / Math.max(1, d.length), rimL: top.reduce((p, q) => p + q, 0) / top.length };
}, [a, b]);
const clip = { x: 360 - 90, y: camY + 400 - 100, width: 180, height: 200 };
const rows = [];
const FACINGS = [['SOUTH', Math.PI / 2], ['EAST', 0], ['NORTH', -Math.PI / 2], ['WEST', Math.PI], ['SE', Math.PI / 4], ['NE', -Math.PI / 4], ['NW', -3 * Math.PI / 4], ['SW', 3 * Math.PI / 4]];
if (EVENTS) {
  const EVS = [['block 17ms', [{ kind: 'block', off: 0, t: 17 }]], ['block 100ms', [{ kind: 'block', off: 0, t: 100 }]], ['block 250ms', [{ kind: 'block', off: 0, t: 250 }]], ['block 420ms', [{ kind: 'block', off: 0, t: 420 }]],
    ['block 100ms off 0.5', [{ kind: 'block', off: 0.5, t: 100 }]], ['tear 90ms', [{ kind: 'tear', off: 0.1, t: 90, n: 2 }]], ['tear 300ms', [{ kind: 'tear', off: 0.1, t: 300, n: 2 }]], ['tear 560ms', [{ kind: 'tear', off: 0.1, t: 560, n: 2 }]], ['tear 640ms', [{ kind: 'tear', off: 0.1, t: 640, n: 2, snapped: true }]]];
  console.log(`${BASE} ${ELITE ? 'ELITE' : 'REGULAR'}${NOBODY ? ' (bearer hidden: no occlusion)' : ''} — visible REACTION pixels (event frame vs the same facing idle), and as a share of SOUTH`);
  for (const [lab, evs] of EVS) {
    const cells = [];
    for (const [n, a] of FACINGS.slice(0, 4)) {
      await page.evaluate(([a, evs]) => window.__ev(a, evs), [a, evs]);
      const on = await page.screenshot({ clip });
      await page.evaluate(([a]) => window.__ev(a, []), [a]);
      const off = await page.screenshot({ clip });
      const r = await lum(`data:image/png;base64,${on.toString('base64')}`, `data:image/png;base64,${off.toString('base64')}`);
      cells.push([n, r.px * r.dL]);
    }
    console.log(`  ${lab.padEnd(20)} ${cells.map(([n, v]) => `${n} ${(v / 1000).toFixed(1).padStart(5)}k (${(v / cells[0][1]).toFixed(2)})`).join('   ')}`);
  }
  await browser.close();
  process.exit(0);
}
for (const [n, a] of FACINGS) {
  await page.evaluate(([a]) => window.__set(a, true), [a]);
  const on = await page.screenshot({ clip });
  await page.evaluate(([a]) => window.__set(a, false), [a]);
  const off = await page.screenshot({ clip });
  const r = await lum(`data:image/png;base64,${on.toString('base64')}`, `data:image/png;base64,${off.toString('base64')}`);
  rows.push({ n, ...r });
}
const S = rows[0];
console.log(`${BASE} ${ELITE ? 'ELITE' : 'REGULAR'}${NOBODY ? ' (bearer hidden: no occlusion)' : ''} xsec=${JSON.stringify(XSEC)}`);
for (const r of rows) console.log(`  ${r.n.padEnd(6)} px ${String(r.px).padStart(5)}  dL ${r.dL.toFixed(1).padStart(5)} (${(r.dL / S.dL).toFixed(2)} of S)  sum ${(r.px * r.dL / 1000).toFixed(1).padStart(6)}k (${((r.px * r.dL) / (S.px * S.dL)).toFixed(2)} of S)  rimL ${r.rimL.toFixed(0)}`);
await browser.close();
