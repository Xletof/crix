// GAIT vs MOTION — how does each role actually move relative to where it aims?
//
// The body's facing (front / back / side) is chosen from the AIM, and the walk
// cycle is a forward walk. This measures, for every moving 60Hz sample in a
// seeded encounter (same player script as diag-move-feel), the angle between
// VELOCITY and AIM, bucketed:  advance <45°, oblique 45-75°, lateral 75-105°,
// back-oblique 105-135°, retreat >135°. It also writes gait-relative-angle.png.
// usage: node tests/diag-gait-angle.mjs [outdir]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
const OUT = process.argv[2] || new URL('../docs/evidence/roster-gait-v2/', import.meta.url).pathname;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const B = ['advance', 'oblique', 'lateral', 'back-oblique', 'retreat'];
async function run(enc, types) {
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  page.on('pageerror', (e) => { console.error(e.message); process.exit(1); });
  await page.goto(`http://localhost:5173/?nodlg=1&nofreeze=1&roster=v1&move=v22&encdbg=${enc}&room=corridor&sector=14&wave=1`);
  await page.waitForFunction(() => window.game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 45000 });
  const r = await page.evaluate(async (types) => {
    const g = window.game; g.loop.sleep();
    let s = 12345; Math.random = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    let t = 1e5; Date.now = () => t; const adv = () => { t += 1000 / 60; g.step(t, 1000 / 60); };
    g.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 4242 }); adv(); adv();
    const gs = g.scene.getScene('Game');
    const url = performance.getEntriesByType('resource').map((q) => q.name).find((n) => /systems\/debug\.js/.test(n));
    (await import(url)).setGodMode(true);
    const out = {}; for (const ty of types) out[ty] = { n: 0, b: [0, 0, 0, 0, 0], fb: [0, 0, 0, 0, 0], still: 0, total: 0 };
    const k = gs.keys;
    for (let i = 0; i < 1500; i++) {
      const ph = Math.floor(i / 75) % 6;
      k.A.isDown = ph === 1; k.D.isDown = ph === 4; k.W.isDown = ph === 2; k.S.isDown = false;
      adv();
      for (const e of gs.enemies.getChildren()) {
        const o = out[e.enemyType]; if (!o || !e.active || !e.alive) continue;
        o.total++;
        const v = e.body.velocity, sp = Math.hypot(v.x, v.y);
        if (sp < 40) { o.still++; continue; }
        const mv = Math.atan2(v.y, v.x);
        const bucket = (d) => (d < 45 ? 0 : d < 75 ? 1 : d < 105 ? 2 : d < 135 ? 3 : 4);
        o.b[bucket(Math.abs(Phaser.Math.RadToDeg(Phaser.Math.Angle.Wrap(mv - e._aim))))]++;
        // ...and against the FACING THE SPRITE SHOWS (aim quantised to E/S/W/N)
        const { dir, flipX } = e._facingSuffix();
        const fa = dir === 'front' ? Math.PI / 2 : dir === 'back' ? -Math.PI / 2 : flipX ? Math.PI : 0;
        o.fb[bucket(Math.abs(Phaser.Math.RadToDeg(Phaser.Math.Angle.Wrap(mv - fa))))]++;
        o.n++;
      }
    }
    return out;
  }, types);
  await page.close();
  return r;
}
const res = { ...(await run('crossfire', ['shooter', 'grunt'])) };
const nest = await run('sniperNest', ['sniper', 'grunt']);
res.sniper = nest.sniper; res['grunt (nest)'] = nest.grunt;
const pct = (a, n) => a.map((x) => Math.round(100 * x / Math.max(1, n)));
const rows = {};
for (const [k, o] of Object.entries(res)) {
  rows[k] = { movingSamples: o.n, stillPct: Math.round(100 * o.still / o.total), ...Object.fromEntries(B.map((b, i) => [`aim:${b}%`, pct(o.b, o.n)[i]])) };
  rows[k + ' vs FACING'] = Object.fromEntries(B.map((b, i) => [`aim:${b}%`, pct(o.fb, o.n)[i]]));
}
console.table(rows);
const page = await browser.newPage();
const url = await page.evaluate(({ res, B }) => {
  const names = { shooter: 'GUNNER (CROSSFIRE)', grunt: 'RIFLEMAN (CROSSFIRE)', sniper: 'MARKSMAN (SNIPER NEST)', 'grunt (nest)': 'RIFLEMAN (SNIPER NEST)' };
  const c = document.createElement('canvas'); c.width = 900; c.height = 120 + Object.keys(res).length * 150;
  const x = c.getContext('2d'); x.fillStyle = '#16181d'; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = '#e4e7ee'; x.font = 'bold 16px monospace'; x.fillText('VELOCITY vs AIM — moving samples (>40px/s), seeded encounters, ?move=v22', 16, 28);
  x.font = '12px monospace'; x.fillStyle = '#aab0bd';
  x.fillText('bars: angle between velocity and aim.  outline: angle vs the FACING the sprite shows (aim quantised to E/S/W/N)', 16, 50);
  const cols = ['#4fb3ff', '#7fd17a', '#ffb347', '#e48a5a', '#e05a7a'];
  Object.entries(res).forEach(([k, o], ri) => {
    const y0 = 80 + ri * 150;
    x.fillStyle = '#e4e7ee'; x.font = 'bold 13px monospace'; x.fillText(`${names[k]}  — ${o.n} moving samples, ${Math.round(100 * o.still / o.total)}% still`, 16, y0);
    B.forEach((b, i) => {
      const p = o.b[i] / Math.max(1, o.n), q = o.fb[i] / Math.max(1, o.n), bx = 16 + i * 175, H = 90;
      x.fillStyle = cols[i]; x.fillRect(bx, y0 + 12 + H - p * H, 120, p * H);
      x.strokeStyle = '#fff'; x.lineWidth = 2; x.strokeRect(bx + 2, y0 + 12 + H - q * H, 116, q * H);
      x.fillStyle = '#d0d4dc'; x.font = '12px monospace'; x.fillText(`${b} ${Math.round(p * 100)}% (${Math.round(q * 100)}%)`, bx, y0 + 12 + H + 16);
    });
  });
  return c.toDataURL();
}, { res, B });
(await import('node:fs')).mkdirSync(OUT, { recursive: true });
writeFileSync(OUT + 'gait-relative-angle.png', Buffer.from(url.split(',')[1], 'base64'));
writeFileSync(OUT + 'gait-relative-angle.json', JSON.stringify(rows, null, 1));
await browser.close();
