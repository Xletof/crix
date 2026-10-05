// `?gait=v2` — the corrected roster-v1 locomotion PRESENTATION. Pinned:
//   - INVARIANCE: seeded CROSSFIRE and SNIPER NEST replays, gait off vs v2 —
//     every position, velocity, v2.2 destination, AI state, cooldown, sniper
//     charge, hp, bolt, the base class's chosen animation key and every random
//     draw identical, and the same shots on the same ticks;
//   - CADENCE: the displayed walk phase advances with real speed, is clamped,
//     returns to idle at rest, and does not thrash around the threshold;
//   - STRUCTURE: one hip socket in profile, a compact stride, both boots east
//     (by construction of the table), no split idle; 51-frame sheets keep the
//     18 animation keys; without the flag nothing changes (33 frames).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const BASE = 'http://localhost:5173/';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const checks = []; const check = (ok, l, d) => checks.push({ ok: !!ok, l, d });
const fail = (m) => { console.error('FAIL', m); process.exit(1); };
async function stepped(q) {
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  page.on('pageerror', (e) => fail(`${q}: ${e.message}`));
  await page.goto(BASE + q);
  await page.waitForFunction(() => window.game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 45000 });
  await page.evaluate(async () => {
    const g = window.game; g.loop.sleep();
    let s = 12345; window.__draws = 0;
    Math.random = () => { window.__draws++; s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    window.__t = 1e5; Date.now = () => window.__t;
    window.__adv = (n = 1) => { for (let i = 0; i < n; i++) { window.__t += 1000 / 60; g.step(window.__t, 1000 / 60); } };
    g.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 4242 }); window.__adv(2);
    const url = performance.getEntriesByType('resource').map((r) => r.name).find((n) => /systems\/debug\.js/.test(n));
    (await import(url)).setGodMode(true);
    window.__gs = g.scene.getScene('Game');
    for (let i = 0; i < 300 && !window.__gs.roomSpec; i++) window.__adv(1);
    window.__adv(20);
  });
  return page;
}
async function replay(enc, q) {
  const page = await stepped(`?nodlg=1&nofreeze=1&roster=v1&move=v22&encdbg=${enc}&room=corridor&sector=14&wave=1${q}`);
  const r = await page.evaluate(() => {
    const gs = window.__gs, ids = new Map(); let nid = 0;
    const id = (e) => { if (!ids.has(e)) ids.set(e, nid++); return ids.get(e); };
    const shots = [], snaps = []; let tick = 0, gaitFrames = 0;
    gs.events.on('shooter-fire', (s, a) => shots.push(`${tick}:${id(s)}:${a.toFixed(6)}:${s.x.toFixed(3)},${s.y.toFixed(3)}`));
    const k = gs.keys;
    for (; tick < 900; tick++) {
      const ph = Math.floor(tick / 90) % 4;
      k.A.isDown = ph === 0; k.D.isDown = ph === 2; k.W.isDown = ph === 1; k.S.isDown = ph === 3;
      if (tick > 450 && tick % 9 === 0) gs.player.keyboardFire();
      window.__adv(1);
      for (const e of gs.enemies.getChildren()) if (e._gait?.walking) gaitFrames++;
      if (tick % 15 === 14) snaps.push(gs.enemies.getChildren().filter((e) => e.active).map((e) => `${id(e)}:${e.enemyType}:${e.x.toFixed(3)},${e.y.toFixed(3)},${e.body.velocity.x.toFixed(3)},${e.body.velocity.y.toFixed(3)},${e.hp},${e.state},${e._aim.toFixed(4)},${e.fireCd?.toFixed?.(2)},${e._chargeMs?.toFixed?.(2)},${e._dest ? e._dest.x.toFixed(2) + '/' + e._dest.y.toFixed(2) : '-'},${e._leg?.mode}/${e._leg?.phase},${e.anims.currentAnim?.key},${e.body.width}`).join('|')
        + `#P${gs.player.x.toFixed(3)},${gs.player.y.toFixed(3)},${gs.player.hp}#B${gs.enemyBullets.getChildren().filter((b) => b.active).map((b) => `${b.x.toFixed(2)},${b.y.toFixed(2)}`).join(';')}#R${window.__draws}`);
    }
    return { shots, snaps, gaitFrames, kills: [...ids.keys()].filter((e) => !e.alive).length };
  });
  await page.close();
  return r;
}
for (const enc of ['crossfire', 'sniperNest']) {
  const a = await replay(enc, ''), b = await replay(enc, '&gait=v2');
  const d = a.snaps.findIndex((s, i) => s !== b.snaps[i]);
  check(a.snaps.length === 60 && d === -1, `${enc}: gait off vs gait=v2 is the SAME FIGHT — positions, velocities, v2.2 destinations + leg state, AI, cooldowns, sniper charge, hp, collider, the base's animation key, bolts, player hp, RNG draws (60 checkpoints)`,
    d < 0 ? '' : `@${d}\nA ${a.snaps[d]?.slice(0, 300)}\nB ${b.snaps[d]?.slice(0, 300)}`);
  check(JSON.stringify(a.shots) === JSON.stringify(b.shots) && a.shots.length > 20, `${enc}: the same ${b.shots.length} shots on the same ticks from the same bodies`, `${a.shots.length} vs ${b.shots.length}`);
  check(b.gaitFrames > 500 && a.gaitFrames === 0, `${enc}: (not vacuous) the v2 gait really drove ${b.gaitFrames} body-frames; off, it drove none`, `${a.gaitFrames}/${b.gaitFrames}`);
}

// ── cadence ────────────────────────────────────────────────────────────────
const pg = await stepped('?nodlg=1&nofreeze=1&roster=v1&gait=v2&encdbg=1&room=detention&sector=1');
const cad = await pg.evaluate(() => {
  const gs = window.__gs; gs.arenaActive = false;
  for (const e of gs.enemies.getChildren().slice()) gs._destroyEnemyFully(e);
  // clear the floor of furniture so nothing stops the test body
  for (const o of gs.roomLayer.getChildren()) { if ((o.displayWidth || 0) >= 1000) continue; if (o.body) o.body.enable = false; }
  gs.walls?.getChildren?.().forEach((w) => { if (w.body) w.body.enable = false; });
  const P = gs.player; P.setPosition(800, 1300); P.body.reset(800, 1300);
  const run = (speed, ticks, wobble = 0) => {
    const e = gs.spawnEnemyAt('grunt', 300, 700, {});
    e._performing = true; e._movePlanted = false; e._aim = 0;      // the AI yields; the base still animates
    let adv = 0, last = null, toggles = 0, prevW = null, frames = new Set(), restarts = 0, prevKey = null;
    for (let i = 0; i < ticks; i++) {
      const v = wobble ? (i % 2 ? speed + wobble : speed - wobble) : speed;
      e.setVelocity(v, 0);
      window.__adv(1);
      const G = e._gait;
      if (G) { if (last !== null) { let d = G.phase - last; if (d < -3) d += 6; adv += d; } last = G.phase; if (prevW !== null && prevW !== G.walking) toggles++; prevW = G.walking; }
      frames.add(+e.frame.name);
      const key = e.anims.currentAnim?.key; if (prevKey && key !== prevKey) restarts++; prevKey = key;
    }
    const r = { phasePerSec: +(adv / (ticks / 60)).toFixed(2), toggles, frames: [...frames].sort((a, b) => a - b), restarts, walking: e._gait?.walking ?? null };
    gs._destroyEnemyFully(e);
    return r;
  };
  return { slow: run(60, 120), normal: run(150, 120), fast: run(260, 120), absurd: run(900, 40), still: run(0, 60), edge: run(14, 180, 3) };
});
await pg.close();
check(cad.slow.phasePerSec > 0 && Math.abs(cad.normal.phasePerSec / cad.slow.phasePerSec - 2.5) < 0.4 && cad.fast.phasePerSec > cad.normal.phasePerSec,
  `cadence follows REAL speed: ${cad.slow.phasePerSec} / ${cad.normal.phasePerSec} / ${cad.fast.phasePerSec} frames/s at 60 / 150 / 260 px/s (the shipped walk is 14 at any speed)`, JSON.stringify(cad));
check(cad.absurd.phasePerSec <= 24.5, `clamped: ${cad.absurd.phasePerSec} frames/s at 900px/s (max 24)`, JSON.stringify(cad.absurd));
check(cad.still.walking === false && cad.still.frames.every((f) => [0, 8, 16].includes(f)), 'a body at rest shows the IDLE frame', JSON.stringify(cad.still));
check(cad.edge.toggles <= 1 && cad.edge.frames.length === 1, `no walk/idle thrash ON SCREEN at the base's 14px/s threshold: the base flips its key ${cad.edge.restarts} times in 3s of 11-17px/s jitter, the displayed frame stays ${cad.edge.frames}`, JSON.stringify(cad.edge));
check(cad.normal.restarts === 0, 'the walk is never restarted: the base animation key does not churn while the gait picks frames', JSON.stringify(cad.normal));

// ── structure ──────────────────────────────────────────────────────────────
const pS = await stepped('?nodlg=1&nofreeze=1&roster=v1&gait=v2');
const st = await pS.evaluate(async () => {
  const url = performance.getEntriesByType('resource').map((r) => r.name).find((n) => /systems\/rosterPaint\.js/.test(n));
  const m = await import(url), gs = window.__gs;
  const anims = ['ro-gun-R', 'ro-rif-E', 'ro-mrk-R'].map((k) => ['front', 'back', 'side'].every((d) => ['idle', 'walk', 'fire', 'raise', 'thrust', 'recoil'].every((a) => gs.anims.exists(`${k}-${a}-${d}`))));
  const frames = ['ro-gun-R', 'ro-gun-E', 'ro-rif-R', 'ro-rif-E', 'ro-mrk-R', 'ro-mrk-E'].map((k) => gs.textures.get(k).frameTotal - 1);
  return { side: m.SIDE2, fb: m.FB2, anims, frames };
});
await pS.close();
const sideAll = [st.side.idle, st.side.fire, ...st.side.walk, ...st.side.strafe];
check(sideAll.every((p) => Math.abs(p.N.f) <= 3 && Math.abs(p.F.f) <= 3 && Math.abs(p.N.k) <= 2 && Math.abs(p.F.k) <= 2),
  'profile: both legs hang from ONE socket; no foot more than 3px, no knee more than 2px, from the hip (the old rear root sat 5-7px behind)', JSON.stringify(sideAll));
check(Math.abs(st.side.idle.N.f - st.side.idle.F.f) <= 2 && Math.abs(st.side.fire.N.f - st.side.fire.F.f) <= 4,
  'profile idle is a modest stagger (2px) and the brace modest (4px) — not the old 5-6px split', JSON.stringify([st.side.idle, st.side.fire]));
check(st.side.walk.every((p) => (p.N.st === 'F') !== (p.F.st === 'F') || (p.N.st === 'F' && p.F.st === 'F')) && st.side.walk.every((p) => p.N.st === 'F' || p.F.st === 'F'),
  'every profile walk frame has a SUPPORTING foot on the deck', JSON.stringify(st.side.walk));
check(st.fb.walk.every((p) => p.L.st === 'F' || p.R.st === 'F') && st.fb.walk.every((p) => Math.abs(p.dx) <= 1 && p.bob <= 1),
  'front/back: a planted foot every frame; weight shift and settle at most 1px', JSON.stringify(st.fb.walk));
check(st.anims.every(Boolean) && st.frames.every((n) => n === 51), `gait v2 sheets: 51 frames (33 + 18 strafe), every one of the 18 animation keys intact`, JSON.stringify(st));
await browser.close();
let bad = 0; for (const c of checks) { console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.l}${c.ok ? '' : `  [${c.d}]`}`); if (!c.ok) bad++; }
console.log(`\n${checks.length - bad}/${checks.length} checks passed`); process.exit(bad ? 1 : 0);
