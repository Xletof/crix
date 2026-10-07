// DIAGNOSTIC (prints numbers, asserts nothing): which painted body facing a
// Bulwark SHOWS against the facing its shield actually points.
//
// `_tickSwarm` accumulates `_shieldFacing += clamp(Wrap(toPlayer - facing))`
// and never wraps the sum, so a shield that turns through west (the ±π seam)
// or follows a player round more than once carries an angle outside
// [-π, π]. Gameplay only ever reads it through sin / cos / Wrap, so the block
// and the gun are right. The painted-facing choice (`_facingSuffix`) reads
// raw degrees.
//
// The REAL AI turns the shield: the player is placed each tick on a scripted
// bearing round the live Bulwark (which follows them), so every angle here
// was produced by `_tickSwarm` itself. Per sample:
//   raw     the accumulated angle the frame was DRAWN from (`_aim` as the AI
//           left it last tick: the base's presentation runs before its AI)
//   wrap    the same angle in (-180, 180]
//   want    the facing the wrapped angle resolves to (same boundary rules)
//   shows   the facing the body is drawn with (anim key + flipX)
//   back    gait v2 walking BACKWARDS against the shown facing
//
// usage: node tests/diag-bulwark-facing.mjs [--base=URL] [--case=human|ccw|cw|all] [--quiet]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const BASE = opt('base', 'http://localhost:5173/');
const CASE = opt('case', 'all');
const QUIET = process.argv.includes('--quiet');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });

// bearing schedules (degrees, Bulwark -> player, screen y down: 90 = south)
export const CASES = {
  // The HUMAN's path: the Bulwark above the player, the player south-west of
  // it, then south-east, then north round its east side. The shield starts on
  // the spawn facing (north) and reaches the south-west player the short way,
  // through west.
  human: [[0, 135], [70, 135], [160, 45], [310, -90], [380, -90]],
  // more than one complete revolution each way, slower than the 2.6 rad/s turn
  ccw: [[0, 90], [40, 90], [40 + 3 * 330, 90 - 3 * 360]],
  cw: [[0, 90], [40, 90], [40 + 3 * 330, 90 + 3 * 360]],
};

async function run(name, sched) {
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  page.on('pageerror', (e) => { console.error(e.message); process.exit(1); });
  await page.goto(`${BASE}?nodlg=1&nofreeze=1&roster=v1&gait=v2&move=v22&encdbg=1&room=detention&sector=1`);
  await page.waitForFunction(() => window.game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 45000 });
  const rows = await page.evaluate(async (sched) => {
    const g = window.game; g.loop.sleep();
    let s = 12345; Math.random = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    window.__t = 1e5; Date.now = () => window.__t;
    const adv = (n = 1) => { for (let i = 0; i < n; i++) { window.__t += 1000 / 60; g.step(window.__t, 1000 / 60); } };
    g.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 4242 }); adv(2);
    const url = performance.getEntriesByType('resource').map((r) => r.name).find((n) => /systems\/debug\.js/.test(n));
    (await import(url)).setGodMode(true);
    const gs = g.scene.getScene('Game');
    for (let i = 0; i < 300 && !gs.roomSpec; i++) adv(1);
    adv(20);
    gs.arenaActive = false; gs._roomModifier = null;
    for (const e of gs.enemies.getChildren().slice()) gs._destroyEnemyFully(e);
    for (const o of gs.roomLayer.getChildren()) if (o.body && (o.displayWidth || 0) < 1000) o.body.enable = false;
    const e = gs.spawnEnemyAt('shielded', 800, 640, {});
    e.fireCd = 1e9;                                    // no shots: nothing here is about the gun's fire
    const P = gs.player, R = 330;
    const bearing = (i) => {
      for (let k = 1; k < sched.length; k++) {
        const [t0, a0] = sched[k - 1], [t1, a1] = sched[k];
        if (i <= t1) return (a0 + (a1 - a0) * ((i - t0) / Math.max(1, t1 - t0))) * Math.PI / 180;
      }
      return sched[sched.length - 1][1] * Math.PI / 180;
    };
    const place = (i) => { const a = bearing(i); P.setPosition(e.x + Math.cos(a) * R, e.y + Math.sin(a) * R); P.body.reset(P.x, P.y); };
    const W = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    const classify = (deg) => (deg >= -45 && deg <= 45 ? 'E' : deg > 45 && deg < 135 ? 'S' : deg >= 135 || deg <= -135 ? 'W' : 'N');
    // an out-of-range angle that lands EXACTLY on a ±45 / ±135 boundary wraps
    // to it plus or minus an ulp; either neighbour is the right answer there
    const accept = (deg) => { const set = new Set([classify(deg)]); for (const b of [-135, -45, 45, 135]) if (Math.abs(deg - b) < 1e-6) { set.add(classify(b - 1e-3)); set.add(classify(b + 1e-3)); } return set; };
    const out = [];
    const end = sched[sched.length - 1][0];
    // the base class draws a frame from the aim the AI left LAST tick (its
    // presentation block runs before the AI), so that is the angle each
    // frame is judged against
    let drawnFrom = e._aim;
    for (let i = 0; i <= end; i++) {
      place(i); adv(1);
      const key = e.anims?.currentAnim?.key || '';
      const shows = key.endsWith('-front') ? 'S' : key.endsWith('-back') ? 'N' : (e.flipX ? 'W' : 'E');
      const raw = drawnFrom, wrap = W(raw);
      drawnFrom = e._aim;
      const G = e._gait;
      let back = false;
      if (G && G.walking && G.mode === 'walk') {
        const fx = shows === 'E' ? 1 : shows === 'W' ? -1 : 0, fy = shows === 'S' ? 1 : shows === 'N' ? -1 : 0;
        back = (G.vx * fx + G.vy * fy) / (Math.hypot(G.vx, G.vy) || 1) < -0.5;
      }
      out.push({ i, bear: Math.round(W(bearing(i)) * 180 / Math.PI), raw: +(raw * 180 / Math.PI).toFixed(1), wrap: +(wrap * 180 / Math.PI).toFixed(1),
        want: accept(wrap * 180 / Math.PI).has(shows) ? shows : classify(wrap * 180 / Math.PI), shows, back, aimIsRaw: e._aim === e._shieldFacing });
    }
    return out;
  }, sched);
  await page.close();
  return rows;
}

const names = CASE === 'all' ? Object.keys(CASES) : [CASE];
for (const n of names) {
  const rows = await run(n, CASES[n]);
  const wrong = rows.filter((r) => r.want !== r.shows), back = rows.filter((r) => r.back);
  const backRight = back.filter((r) => r.want === r.shows);
  const rawOut = rows.filter((r) => Math.abs(r.raw) > 180);
  console.log(`\n== ${n} (${BASE}) — ${rows.length} ticks; raw outside ±180 on ${rawOut.length}; WRONG FACING SHOWN on ${wrong.length}; gait walking BACKWARDS against the shown facing on ${back.length} (of which ${backRight.length} with the RIGHT facing shown: the shield still turning toward a player behind it)`);
  const ex = wrong[0];
  if (ex) console.log(`   first wrong: tick ${ex.i} raw ${ex.raw}° (wrapped ${ex.wrap}°) should show ${ex.want}, shows ${ex.shows}`);
  if (!QUIET) {
    let last = '';
    for (const r of rows) {
      const sig = `${r.want}|${r.shows}|${r.back}`;
      if (sig !== last || r.i % 60 === 0) console.log(`   t${String(r.i).padStart(4)} bearing ${String(r.bear).padStart(4)}  raw ${String(r.raw).padStart(7)}  wrap ${String(r.wrap).padStart(6)}  want ${r.want}  shows ${r.shows}${r.want !== r.shows ? '  <-- WRONG' : ''}${r.back ? '  backpedal' : ''}`);
      last = sig;
    }
  }
}
await browser.close();
