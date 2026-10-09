// DIAGNOSTIC (prints numbers, asserts nothing): THE FRESH-SPAWN SIDESTEP.
//
// A Demolisher spawned in a CLEAR lane rushes a standing player. Per tick it
// records everything the shared stuck-recovery block in `Enemy.preUpdate`
// reads and writes:
//
//   if (_inMoveState) {                       // swarm behaviour: always true
//     _stuckSidestepMs -= delta; _stuckTimer += delta;
//     if (_stuckTimer >= 600) {
//       moved = hypot(x - (_stuckRefX ?? x), y - (_stuckRefY ?? y));
//       if (moved < 12) { _stuckSidestepMs = 600; _stuckSideDir = random() < .5 ? 1 : -1; }
//       _stuckTimer = 0; _stuckRefX = x; _stuckRefY = y;
//     }
//   }
//
// and whether `_moveToward` took its perpendicular sidestep branch that tick.
//
// usage: node tests/diag-demolisher-veer.mjs [--base=URL] [--flags=...] [--case=clear|wall] [--elite] [--quiet]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const BASE = opt('base', 'http://localhost:5173/');
const FLAGS = opt('flags', '');
const CASE = opt('case', 'clear');
const ELITE = process.argv.includes('--elite');
const QUIET = process.argv.includes('--quiet');

export async function veerRun(browser, { base = BASE, flags = FLAGS, kase = CASE, elite = ELITE, ticks = 110 } = {}) {
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  page.on('pageerror', (e) => { console.error(e.message); process.exit(1); });
  await page.goto(`${base}?nodlg=1&nofreeze=1${flags ? `&${flags}` : ''}&encdbg=1&room=hangar&sector=1`);
  await page.waitForFunction(() => window.game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 45000 });
  const out = await page.evaluate(async ({ kase, elite, ticks }) => {
    const g = window.game; g.loop.sleep();
    let s = 12345; window.__draws = 0;
    Math.random = () => { window.__draws++; s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    window.__t = 1e5; Date.now = () => window.__t;
    const adv = (n = 1) => { for (let i = 0; i < n; i++) { window.__t += 1000 / 60; g.step(window.__t, 1000 / 60); } };
    g.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 4242 }); adv(2);
    const url = performance.getEntriesByType('resource').map((r) => r.name).find((n) => /systems\/debug\.js/.test(n));
    (await import(url)).setGodMode(true);
    const gs = g.scene.getScene('Game');
    for (let i = 0; i < 300 && !gs.roomSpec; i++) adv(1);
    adv(20);
    gs.arenaActive = false; gs._roomModifier = null;
    if (gs.arenaCfg) gs.arenaCfg = { ...gs.arenaCfg, speedMult: undefined };   // base speed, whatever modifier the seed rolled
    for (const e of gs.enemies.getChildren().slice()) gs._destroyEnemyFully(e);
    // the clear lane: nothing solid anywhere near the run
    for (const o of gs.roomLayer.getChildren()) if (o.body && (o.displayWidth || 0) < 1000) o.body.enable = false;
    const P = gs.player; P.setPosition(820, 1000); P.body.reset(820, 1000);
    let wall = null;
    if (kase === 'wall') {
      // a REAL obstruction: a static body square across the lane, 140px in front of the spawn
      wall = gs.add.rectangle(820, 560, 360, 40, 0x884422, 0.9).setDepth(5000);
      gs.physics.add.existing(wall, true);
      gs.walls.add(wall);
    }
    const sx = 820, sy = 420;
    const e = gs.spawnEnemyAt('bomber', sx, sy, elite ? { elite: true } : {});
    // which branch `_moveToward` took, per tick
    let branch = '';
    const mt = e._moveToward.bind(e);
    e._moveToward = (tx, ty, sp) => { branch = e._stuckSidestepMs > 0 ? 'SIDESTEP' : 'toward'; return mt(tx, ty, sp); };
    const rows = [];
    for (let i = 0; i < ticks && e.alive; i++) {
      branch = '';
      const d0 = window.__draws;
      adv(1);
      if (!e.alive) { rows.push({ i, dead: true }); break; }
      const want = Math.atan2(P.y - e.y, P.x - e.x), head = Math.atan2(e.body.velocity.y, e.body.velocity.x);
      const sp = Math.hypot(e.body.velocity.x, e.body.velocity.y);
      rows.push({
        i, ms: Math.round((i + 1) * 1000 / 60), x: +e.x.toFixed(1), y: +e.y.toFixed(1), vx: Math.round(e.body.velocity.x), vy: Math.round(e.body.velocity.y),
        fromSpawn: +Math.hypot(e.x - sx, e.y - sy).toFixed(1), off: sp > 1 ? Math.round(Math.abs(Math.atan2(Math.sin(head - want), Math.cos(head - want))) * 180 / Math.PI) : null,
        timer: e._stuckTimer != null ? Math.round(e._stuckTimer) : null, refX: e._stuckRefX ?? null, refY: e._stuckRefY ?? null,
        side: Math.round(e._stuckSidestepMs || 0), dir: e._stuckSideDir ?? null, branch,
        blocked: !e.body.blocked.none || !e.body.touching.none, draws: window.__draws - d0,
      });
    }
    return { rows, cfg: { speed: e.cfg.speed, radius: e.cfg.radius, elite: !!e._elite, tex: e.texture.key }, wall: !!wall, alive: e.alive };
  }, { kase, elite, ticks });
  await page.close();
  return out;
}

/** The first tick a sidestep is armed, and what the stuck test thought it measured. */
export function veerSummary(r) {
  const rows = r.rows.filter((x) => !x.dead);
  const first = rows.find((x) => x.side > 0);
  const sideTicks = rows.filter((x) => x.branch === 'SIDESTEP').length;
  const maxOff = Math.max(0, ...rows.filter((x) => x.branch === 'SIDESTEP' && x.off != null).map((x) => x.off));
  return { first, sideTicks, maxOff, blockedTicks: rows.filter((x) => x.blocked).length, n: rows.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const r = await veerRun(browser);
  const sm = veerSummary(r);
  console.log(`${BASE} flags=[${FLAGS}] case=${CASE}${ELITE ? ' ELITE' : ''} — ${r.cfg.tex} speed ${r.cfg.speed} r${r.cfg.radius}${r.wall ? ' (a real wall across the lane)' : ' (clear lane)'}`);
  if (sm.first) console.log(`  sidestep ARMED at tick ${sm.first.i} (${sm.first.ms}ms after spawn): moved ${sm.first.fromSpawn}px from spawn, contact ${sm.first.blocked ? 'YES' : 'none'}; ${sm.sideTicks} ticks of perpendicular travel (up to ${sm.maxOff}deg off the bearing to the player)`);
  else console.log('  no sidestep armed');
  if (!QUIET) {
    console.log('   tick   ms     x       y      vx    vy  fromSpawn off  timer  refX    refY   side dir branch   blocked draws');
    for (const x of r.rows) {
      if (x.dead) { console.log(`   ${String(x.i).padStart(4)} DETONATED`); continue; }
      if (x.i % 3 === 0 || x.side >= 580 || (x.i >= 33 && x.i <= 38)) {
        console.log(`   ${String(x.i).padStart(4)} ${String(x.ms).padStart(5)} ${String(x.x).padStart(6)} ${String(x.y).padStart(7)} ${String(x.vx).padStart(5)} ${String(x.vy).padStart(5)} ${String(x.fromSpawn).padStart(8)} ${String(x.off ?? '-').padStart(4)} ${String(x.timer).padStart(5)} ${String(x.refX?.toFixed?.(1) ?? 'undef').padStart(6)} ${String(x.refY?.toFixed?.(1) ?? 'undef').padStart(7)} ${String(x.side).padStart(4)} ${String(x.dir ?? '-').padStart(3)} ${x.branch.padEnd(8)} ${x.blocked ? 'YES' : '-'}      ${x.draws}`);
      }
    }
  }
  await browser.close();
}
