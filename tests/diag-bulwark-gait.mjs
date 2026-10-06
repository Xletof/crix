// DIAGNOSTIC (prints numbers, asserts nothing): how the Bulwark actually moves
// relative to the facing its sprite shows, in real encounters, and which gait-v2
// mode the presentation tick chose for it. Same instrument as the gait audit
// (diag-gait-angle.mjs): REAL displacement per frame, never the velocity the AI
// just wrote.
//
// usage: node tests/diag-bulwark-gait.mjs
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const BASE = 'http://localhost:5173/';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const CASES = [
  ['VANGUARD A (sector 8, wave 2)', 'encdbg=vanguard&room=hangar&sector=8&wave=2'],
  ['VANGUARD, no Captain', 'encdbg=vanguard&room=hangar&sector=8&wave=2&nochamp=1'],
  ['MIXED (junction, sector 6)', 'encdbg=mixed&room=corridor&sector=6&wave=1'],
];
for (const [name, q] of CASES) {
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  await page.goto(`${BASE}?nodlg=1&nofreeze=1&roster=v1&gait=v2&move=v22&${q}`);
  await page.waitForFunction(() => window.game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 45000 });
  const r = await page.evaluate(async () => {
    const g = window.game; g.loop.sleep();
    let s = 12345; Math.random = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    window.__t = 1e5; Date.now = () => window.__t;
    const adv = (n = 1) => { for (let i = 0; i < n; i++) { window.__t += 1000 / 60; g.step(window.__t, 1000 / 60); } };
    g.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 4242 }); adv(2);
    const url = performance.getEntriesByType('resource').map((x) => x.name).find((n) => /systems\/debug\.js/.test(n));
    (await import(url)).setGodMode(true);
    const gs = g.scene.getScene('Game');
    for (let i = 0; i < 300 && !gs.roomSpec; i++) adv(1);
    adv(20);
    const last = new Map(), bins = { still: 0, advance: 0, strafe: 0, retreat: 0 }, modes = { walk: 0, strafe: 0, idle: 0, other: 0 };
    let hold = 0, frames = 0;
    const k = gs.keys;
    for (let tick = 0; tick < 1500; tick++) {
      const ph = Math.floor(tick / 120) % 4;
      k.A.isDown = ph === 0; k.D.isDown = ph === 2; k.W.isDown = ph === 1; k.S.isDown = ph === 3;
      if (tick > 300 && tick % 9 === 0) gs.player.keyboardFire();
      adv(1);
      for (const e of gs.enemies.getChildren()) {
        if (!e.active || !e.alive || e.enemyType !== 'shielded') continue;
        const p = last.get(e); last.set(e, { x: e.x, y: e.y });
        if (!p) continue;
        frames++;
        if (e._screenHolding) hold++;
        const vx = (e.x - p.x) * 60, vy = (e.y - p.y) * 60, sp = Math.hypot(vx, vy);
        const key = e.anims?.currentAnim?.key || '';
        const dir = key.endsWith('-front') ? 'front' : key.endsWith('-back') ? 'back' : 'side';
        const fx = dir === 'side' ? (e.flipX ? -1 : 1) : 0, fy = dir === 'front' ? 1 : dir === 'back' ? -1 : 0;
        if (sp < 12) bins.still++;
        else { const along = (vx * fx + vy * fy) / sp; if (along >= 0.5) bins.advance++; else if (along <= -0.5) bins.retreat++; else bins.strafe++; }
        const G = e._gait;
        if (!G || !G.walking) modes.idle++; else if (G.mode === 'walk') modes.walk++; else if (G.mode === 'strafe') modes.strafe++; else modes.other++;
      }
    }
    return { bins, modes, hold, frames };
  });
  const pc = (n) => `${((100 * n) / Math.max(1, r.frames)).toFixed(1)}%`;
  console.log(`${name}: ${r.frames} Bulwark-frames | still ${pc(r.bins.still)}, advance ${pc(r.bins.advance)}, strafe ${pc(r.bins.strafe)}, retreat ${pc(r.bins.retreat)} | gait mode: idle ${pc(r.modes.idle)}, walk ${pc(r.modes.walk)}, strafe ${pc(r.modes.strafe)} | VANGUARD close hold ${pc(r.hold)}`);
  await page.close();
}
await browser.close();
