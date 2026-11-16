// DIAG: B2 TRACER REPRODUCTION MATRIX (B2-B on the firing range, &b2dbg=1). Prints the tracer
// invariant counters per scenario and saves frames that show a violation. usage: node tests/diag-b2-tracers.mjs OUTDIR [base]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { CHROME } from '/home/user/crix/tests/diag-stuck-audit.mjs';
const out = process.argv[2], base = process.argv[3] || 'http://localhost:5173/';
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(`${base}?nodlg=1&nofreeze=1&visualPilot=v2c&polish=p1&fxPilot=p2a3&b2=B&b2range=1&b2dbg=1&room=hangar`);
await page.waitForFunction(() => window.game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 60000 });
await page.evaluate(async () => {
  const g = window.game; g.loop.sleep();
  let s = 12345; Math.random = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  let t = 1e5; Date.now = () => t;
  window.__adv = (n = 1, render = false) => { for (let i = 0; i < n; i++) { t += 1000 / 60; if (render) g.step(t, 1000 / 60); else g.headlessStep(t, 1000 / 60); } };
  g.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 4242 }); window.__adv(2);
  const gs = window.__gs = g.scene.getScene('Game');
  for (let i = 0; i < 400 && !gs.roomSpec; i++) window.__adv(1);
  window.__adv(120);
  const rp = document.getElementById('b2-range'); if (rp) rp.style.display = 'none';
  window.__stick = (ang) => { const fs = g.scene.getScene('HUD').fireStick; if (ang == null) { fs.active = false; fs.vec = { x: 0, y: 0, force: 0, angle: 0 }; return; } fs.active = true; fs.vec = { x: Math.cos(ang), y: Math.sin(ang), force: 1, angle: ang }; };
  window.__inv = () => { const i = gs._b2.stats.feel.inv; return { checks: i.checks, bad: i.bad, maxOff: +i.maxOff.toFixed(2), maxEndErr: +i.maxEndErr.toFixed(1), samples: i.samples.slice(0, 3) }; };
  window.__reset = () => { const i = gs._b2.stats.feel.inv; i.checks = 0; i.bad = 0; i.samples.length = 0; i.maxOff = 0; i.maxEndErr = 0; };
  window.__place = (x, y) => { const P = gs.player; P.x = x; P.y = y; P.body.reset(x, y); };
});
const scenario = async (name, fn) => {
  await page.evaluate(() => window.__reset());
  await page.evaluate(fn);
  const r = await page.evaluate(() => window.__inv());
  console.log(`${name.padEnd(44)} checks ${String(r.checks).padStart(5)}  BAD ${String(r.bad).padStart(4)}  max off ${r.maxOff}px  max end err ${r.maxEndErr}px${r.samples.length ? '  e.g. ' + JSON.stringify(r.samples[0]) : ''}`);
  return r;
};
// 1. eight directions, stationary, empty space
await scenario('1 stationary, 8 directions, empty space', () => { const gs = window.__gs; gs._b2.range.clear(); window.__place(800, 800); window.__adv(30); for (let k = 0; k < 8; k++) { window.__stick(k * Math.PI / 4); window.__adv(40); window.__stick(null); window.__adv(25); } });
// 2. continuous rotation
await scenario('2 rotating 360 deg/s while firing', () => { window.__place(800, 800); for (let i = 0; i < 240; i++) { window.__stick(i * (2 * Math.PI / 60)); window.__adv(1); } window.__stick(null); window.__adv(40); });
// 3. kills first, then blank space (pool reuse after body contacts)
await scenario('3 kill a squad, then blank-space bursts', () => { const gs = window.__gs; window.__place(800, 800); gs._b2.range.spawn('SQUAD'); window.__adv(40); gs.cursors.space.isDown = true; for (let i = 0; i < 400 && gs.enemies.getChildren().some((e) => e.alive); i++) window.__adv(1); gs.cursors.space.isDown = false; window.__adv(30); for (let k = 0; k < 8; k++) { window.__stick(k * Math.PI / 4 + 0.3); window.__adv(30); window.__stick(null); window.__adv(10); } });
// 4. near cover and the arena edge
await scenario('4 into cover and the arena edge', () => { const gs = window.__gs; const r = (gs.losRects || []).find((q) => q.width < 300) || gs.losRects[0]; window.__place(r.x - 160, r.centerY); window.__adv(5); window.__stick(0); window.__adv(60); window.__stick(null); window.__place(140, 800); window.__adv(5); window.__stick(Math.PI); window.__adv(60); window.__stick(null); window.__adv(40); });
// 5. dense combat
await scenario('5 dense combat (HORDE x2), auto aim', () => { const gs = window.__gs; window.__place(800, 900); gs._b2.range.spawn('HORDE'); gs._b2.range.spawn('HORDE'); window.__adv(30); gs.cursors.space.isDown = true; for (let i = 0; i < 500 && gs.enemies.getChildren().some((e) => e.alive); i++) window.__adv(1); gs.cursors.space.isDown = false; window.__adv(30); });
// 6. the footage pattern: kills, then sweep empty space while walking
await scenario('6 kills, then walk + fire into empty space', () => { const gs = window.__gs, K = gs.keys; window.__place(700, 900); gs._b2.range.spawn('SWARM'); gs._b2.range.spawn('SQUAD'); window.__adv(30); gs.cursors.space.isDown = true; for (let i = 0; i < 400 && gs.enemies.getChildren().some((e) => e.alive); i++) window.__adv(1); for (let i = 0; i < 240; i++) { K.W.isDown = i % 120 < 60; K.D.isDown = i % 120 >= 60; window.__adv(1); } K.W.isDown = K.D.isDown = false; gs.cursors.space.isDown = false; window.__adv(40); });
// a rendered frame of the stale case for the evidence
await page.evaluate(() => { const gs = window.__gs; window.__reset(); window.__place(800, 800); gs._b2.range.spawn('SQUAD'); window.__adv(40); gs.cursors.space.isDown = true; for (let i = 0; i < 400 && gs.enemies.getChildren().some((e) => e.alive); i++) window.__adv(1); gs.cursors.space.isDown = false; window.__adv(20); });
let shots = 0;
for (let k = 0; k < 90 && shots < 4; k++) {
  const bad0 = await page.evaluate(() => window.__gs._b2.stats.feel.inv.bad);
  await page.evaluate((k) => { window.__stick(Math.PI + 0.5 + (k % 8) * 0.25); window.__adv(1, true); }, k);
  const bad1 = await page.evaluate(() => window.__gs._b2.stats.feel.inv.bad);
  if (bad1 > bad0) { await page.screenshot({ path: `${out}/stale-${shots}.png` }); shots++; }
}
console.log('frames saved with a violation on screen:', shots);
// the same moment rendered whatever happens (the AFTER evidence): blank-space bursts after kills
for (let k = 0; k < 3; k++) {
  await page.evaluate((k) => { window.__stick(Math.PI + 0.5 + k * 0.9); window.__adv(14, true); }, k);
  await page.screenshot({ path: `${out}/after-kills-${k}.png` });
}
const st = await page.evaluate(() => ({ stale: window.__gs._b2.stats.feel.staleContacts, ...window.__inv() }));
console.log('stale contacts refused by the generation check:', st.stale ?? 'n/a', '| invariant now:', JSON.stringify({ checks: st.checks, bad: st.bad }));
await browser.close();
