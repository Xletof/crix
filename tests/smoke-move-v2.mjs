// `?move=v2` / `v21` / `v22` — the candidate locomotion reaches exactly the
// bodies it should. Off by default; on, only Gunner (shooter) and Rifleman
// (grunt), never a nemesis, swarmling, Bulwark, Marksman, Demolisher or the
// Captain. v22 adds destination ownership: two Gunners standing on the same
// spot must claim DIFFERENT places, and a leg's direction is fixed when it
// starts (nothing re-scores it frame to frame).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const checks = []; const check = (ok, l, d) => checks.push({ ok: !!ok, l, d });
async function probe(q) {
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  page.on('pageerror', (e) => { console.error(e.message); process.exit(1); });
  await page.goto('http://localhost:5173/' + q);
  await page.waitForFunction(() => window.game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 45000 });
  const r = await page.evaluate(async () => {
    const g = window.game; g.loop.sleep(); let t = 1e5; Date.now = () => t; const adv = (n) => { for (let i = 0; i < n; i++) { t += 1000 / 60; g.step(t, 1000 / 60); } };
    g.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 4242 }); adv(40);
    const gs = g.scene.getScene('Game'); gs.arenaActive = false;
    const out = {};
    for (const [k, type, spec] of [['shooter', 'shooter', {}], ['shooterE', 'shooter', { elite: true }], ['grunt', 'grunt', {}], ['shielded', 'shielded', {}], ['sniper', 'sniper', {}], ['bomber', 'bomber', {}], ['swarmling', 'swarmling', {}]]) {
      const e = gs.spawnEnemyAt(type, 700, 700, spec); out[k] = !!e._loco; out[k + 'V22'] = !!e._v22; out[k + 'Lane'] = typeof e._lane === 'number'; gs._destroyEnemyFully(e);
    }
    const n = gs._spawnMiniBoss(); out.nemesis = !!n._loco || !!n._v22; gs._destroyEnemyFully(n);
    const c = gs.spawnChampion(700, 700, 'captain'); out.captain = !!c._loco || !!c._v22; gs._destroyEnemyFully(c);
    return out;
  });
  await page.close(); return r;
}
// two Gunners on one spot inside the band, the player still: where do they go?
async function claims(q) {
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  page.on('pageerror', (e) => { console.error(e.message); process.exit(1); });
  await page.goto('http://localhost:5173/' + q);
  await page.waitForFunction(() => window.game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 45000 });
  const r = await page.evaluate(async () => {
    const g = window.game; g.loop.sleep(); let t = 1e5; Date.now = () => t; const adv = (n) => { for (let i = 0; i < n; i++) { t += 1000 / 60; g.step(t, 1000 / 60); } };
    let s = 777; Math.random = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    g.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 4242 }); adv(40);
    const gs = g.scene.getScene('Game'); gs.arenaActive = false;
    gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
    const url = performance.getEntriesByType('resource').map((r) => r.name).find((n) => /systems\/debug\.js/.test(n));
    (await import(url)).setGodMode(true);
    const P = gs.player; P.setPosition(800, 700); P.body.reset(800, 700);
    const a = gs.spawnEnemyAt('shooter', 800, 1010, { behavior: 'swarm', alerted: true });
    const b = gs.spawnEnemyAt('shooter', 803, 1012, { behavior: 'swarm', alerted: true });
    for (const e of [a, b]) { e.fireCd = 1e9; }
    const first = {}; let legs = 0, bent = 0, last = new Map();
    for (let i = 0; i < 150; i++) {
      adv(1);
      P.setPosition(800, 700); P.body.reset(800, 700);
      for (const [k, e] of [['a', a], ['b', b]]) {
        if (e._dest && !first[k]) first[k] = { x: e._dest.x, y: e._dest.y };
        const L = e._leg; if (!L) continue;
        const prev = last.get(e);
        if (L.phase === 'move') {
          if (prev && prev.phase === 'move' && prev.dest === L.dest && (prev.dx !== L.dx || prev.dy !== L.dy)) bent++;
          if (!prev || prev.phase !== 'move') legs++;
        }
        last.set(e, { phase: L.phase, dx: L.dx, dy: L.dy, dest: L.dest });
      }
    }
    const d = (p, q) => (p && q ? Math.round(Math.hypot(p.x - q.x, p.y - q.y)) : -1);
    return { claimGap: d(first.a, first.b), apart: d(a, b), legs, bent, hasDest: !!(a._dest || b._dest) };
  });
  await page.close(); return r;
}
const off = await probe('?nodlg=1&nofreeze=1');
const on = await probe('?nodlg=1&nofreeze=1&move=v2');
const v21 = await probe('?nodlg=1&nofreeze=1&move=v21');
const v22 = await probe('?nodlg=1&nofreeze=1&move=v22');
check(Object.values(off).every((v) => !v), 'default: no body runs the candidate locomotion', JSON.stringify(off));
check(on.shooter && on.shooterE && on.grunt, '?move=v2: Gunner (regular + elite) and Rifleman run it', JSON.stringify(on));
check(!on.shielded && !on.sniper && !on.bomber && !on.swarmling && !on.nemesis && !on.captain, '?move=v2: Bulwark, Marksman, Demolisher, swarmling, nemesis and Captain do not', JSON.stringify(on));
check(!on.shooterV22 && !on.shooterLane && v21.shooterLane && !v21.shooterV22, 'v2 is plain legs, v21 adds lanes and no destinations — both stay available for A/B', JSON.stringify({ on, v21 }));
check(v22.shooter && v22.shooterE && v22.grunt && v22.shooterV22 && v22.shooterEV22 && v22.gruntV22 && !v22.shooterLane,
  '?move=v22: Gunner (regular + elite) and Rifleman run legs with destination ownership, and no permanent lane', JSON.stringify(v22));
check(!v22.shielded && !v22.sniper && !v22.bomber && !v22.swarmling && !v22.nemesis && !v22.captain && !v22.shieldedV22 && !v22.sniperV22 && !v22.bomberV22 && !v22.swarmlingV22,
  '?move=v22: Bulwark, Marksman, Demolisher, swarmling, nemesis and Captain do not', JSON.stringify(v22));
const c22 = await claims('?nodlg=1&nofreeze=1&roster=v1&move=v22');
const c2 = await claims('?nodlg=1&nofreeze=1&roster=v1&move=v2');
check(c22.claimGap >= 60 && c22.apart >= 90, `v22: two Gunners on one spot claim different places (${c22.claimGap}px apart) and end ${c22.apart}px apart`, JSON.stringify(c22));
check(c22.legs >= 2 && c22.bent === 0, `v22: ${c22.legs} legs, each one direction from start to end (no per-frame re-scoring)`, JSON.stringify(c22));
check(!c2.hasDest && c2.claimGap === -1, '(A/B) v2 publishes no destination at all — the check above can fail', JSON.stringify(c2));
await browser.close();
let bad = 0; for (const c of checks) { console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.l}${c.ok ? '' : '  [' + c.d + ']'}`); if (!c.ok) bad++; }
console.log(`\n${checks.length - bad}/${checks.length} checks passed`); process.exit(bad ? 1 : 0);
