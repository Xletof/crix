// THE HARROWER — Phase B.1 structural checks.
//
// BEHAVIOUR, NEVER TASTE. There is deliberately no assertion here that the
// craft is fast, or that its wake is wide, or that a Champion "should" be
// anything: the rejected Interdictor's speed error survived to the handset
// precisely because `smoke-champion` had pinned it as an invariant. What is
// asserted is what can be WRONG INVISIBLY — a hazard outliving its author, a
// damaging region that is not the drawn region, a Champion leaking into normal
// Endless, and the one failure this whole concept exists against:
//
//   NO ACCIDENTAL INTERDICTOR STATE — outside its own bounded bank, the craft
//   must never settle into a long stationary standoff.
// NOTE — THE CANDIDATE IS NAMED EXPLICITLY, ON PURPOSE. `?champdbg=1` spawns
// whatever the ACTIVE Champion candidate is, and that is now the Shock Captain
// (`HANDOVER.md` §10ag); the Harrower is human-rejected and reachable only by
// id. A test that rides the default is a test that silently changes subject the
// next time the default does.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = 'http://localhost:5173/';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const fail = (m) => { console.error(`FAIL: ${m}`); process.exit(1); };
const checks = [];
const check = (ok, label, detail) => { checks.push({ ok, label, detail }); };

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
async function run(query, fn) {
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  page.on('pageerror', (e) => fail(`page error (${query}): ${String(e).split('\n')[0]}`));
  await page.goto(BASE + query);
  await page.waitForTimeout(4500);
  await page.mouse.click(360, 640);
  await page.waitForTimeout(800);
  await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 5150 }));
  await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
  await page.waitForTimeout(2200);
  const out = await fn(page);
  await page.close();
  return out;
}

// ── 1. Identity and body ───────────────────────────────────────────────────
const id = await run('?nodlg=1&champdbg=harrower', async (page) => page.evaluate(async () => {
  const { HARROWER, BOSS } = await import('/src/config.js');
  const gs = window.game.scene.getScene('Game');
  const { setGodMode } = await import('/src/systems/debug.js');
  setGodMode(true);
  const h = gs.enemies.getChildren().find((e) => e.alive && e.isChampion)
    || gs.spawnChampion(gs.player.x + 420, gs.player.y);
  return {
    which: h._championId,
    tex: h.texture.key,
    ordinary: [...new Set(gs.enemies.getChildren().filter((e) => !e.isChampion).map((e) => e.texture.key))],
    bodyR: h.body.radius, cfgR: HARROWER.radius,
    w: h.width, hh: h.height,
    wider: h.width > h.height,
    bossR: BOSS.radius,
    hasWeapon: !!h.weaponSprite,
    // NavGrid inflates a body rect by 23px per side; the junction's authored
    // lane is 160px and was derived for Vader's Ø112.
    needsGap: HARROWER.radius * 2 + 46,
    rotates: typeof h.rotation === 'number',
  };
}));
check(id.which === 'harrower', 'the flag spawns the HARROWER, not the rejected candidate', id.which);
check(id.tex === 'champ-harrower' && !id.ordinary.includes(id.tex),
  'it has its own sheet, shared with no ordinary enemy', id.ordinary.join(','));
check(id.bodyR === id.cfgR, 'the collider is the configured body', `${id.bodyR} vs ${id.cfgR}`);
check(id.wider, 'THE VISUAL IS WIDER THAN TALL — no other actor in the game is', `${id.w}x${id.hh}`);
check(id.w / (id.bodyR * 2) < 2.6, 'the art does not promise more mass than the collider has',
  `${id.w} over Ø${id.bodyR * 2}`);
check(id.needsGap <= 160, 'it fits the junction lane — anywhere Vader walks, it walks', `${id.needsGap}px`);
check(id.bodyR * 2 < id.bossR * 2, 'and it is smaller than the boss', `${id.bodyR * 2} vs ${id.bossR * 2}`);
check(!id.hasWeapon, 'it carries no weapon — Phase B.1 has no signature attacks at all', '');

// ── 2. The loop: it does not stand still ───────────────────────────────────
const loop = await run('?nodlg=1&champdbg=harrower&encdbg=crossfire&room=hangar&sector=6', async (page) => {
  await page.evaluate(async () => {
    const { setGodMode } = await import('/src/systems/debug.js');
    setGodMode(true);
    const gs = window.game.scene.getScene('Game');
    if (!gs.enemies.getChildren().some((e) => e.alive && e.isChampion)) {
      gs.spawnChampion(gs.player.x + 420, gs.player.y);
    }
    const S = { ms: 0, moving: 0, run: 0, worst: 0, worstState: null, states: {}, passes: 0, maxWake: 0, maxPts: 0 };
    window.__S = S;
    gs.events.on('postupdate', () => {
      const h = gs.enemies.getChildren().find((e) => e.alive && e.isChampion);
      const d = gs.game.loop.delta; S.ms += d;
      if (!h) return;
      S.states[h._hrw] = (S.states[h._hrw] || 0) + d;
      S.passes = h._passCount;
      if (h.wake && !h.wake.dead) {
        S.maxWake = Math.max(S.maxWake, h.wake.length);
        S.maxPts = Math.max(S.maxPts, h.wake.points.length);
      }
      const v = Math.hypot(h.body.velocity.x, h.body.velocity.y);
      if (v > 20) { S.moving += d; S.run = 0; }
      else if (h._hrw === 'bank' || h._hrw === 'decel') { S.run = 0; }   // designed stops
      else { S.run += d; if (S.run > S.worst) { S.worst = S.run; S.worstState = h._hrw; } }
    });
  });
  await page.waitForTimeout(26000);
  return page.evaluate(() => ({ ...window.__S, states: { ...window.__S.states } }));
});
check(loop.passes >= 3, 'it completes multiple passes inside a short window', `${loop.passes}`);
check(loop.moving / loop.ms > 0.6,
  'IT IS MOVING FOR MOST OF THE FIGHT — the rejected candidate was not',
  `${(100 * loop.moving / loop.ms).toFixed(0)}%`);
check(loop.worst < 1200,
  'NO ACCIDENTAL INTERDICTOR STATE — no long stationary standoff outside the bank',
  `worst ${Math.round(loop.worst)}ms in ${loop.worstState}`);
check((loop.states.bank || 0) > 0 && (loop.states.pass || 0) > 0,
  'the loop actually reaches both PASS and BANK', JSON.stringify(loop.states));
check(loop.maxPts <= 64, 'the wake stays inside its segment cap', `${loop.maxPts}`);
check(loop.maxWake < 1300, 'and its length is bounded — a trail, never a cage', `${Math.round(loop.maxWake)}px`);

// ── 3. The wake: caused by movement, and drawn where it hurts ──────────────
const wake = await run('?nodlg=1&champdbg=harrower&room=hangar&sector=6', async (page) => page.evaluate(async () => {
  const { HARROWER } = await import('/src/config.js');
  const { setGodMode } = await import('/src/systems/debug.js');
  setGodMode(true);
  const gs = window.game.scene.getScene('Game');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let h = gs.enemies.getChildren().find((e) => e.alive && e.isChampion);
  if (!h) h = gs.spawnChampion(gs.player.x + 420, gs.player.y);

  // NO MOVEMENT, NO WAKE. Hold it still and the trail must age out completely —
  // this is the property that separates the Harrower from a hazard emitter.
  gs.clearHazards();
  h._hrw = 'bank'; h._stateMs = -99999;          // park it without touching config
  h.setVelocity(0, 0);
  await wait(HARROWER.wakeLifeMs + 700);
  const parkedPts = h.wake ? h.wake.points.length : 0;

  // Let it run again and catch a live trail.
  h._stateMs = 99999;
  for (let i = 0; i < 300; i++) { await wait(50); if (h._hrw === 'pass' && (h.wake?.length ?? 0) > 200) break; }
  const w = h.wake;
  let geom = null;
  if (w && w.points.length > 2) {
    const a = w.points[Math.floor(w.points.length / 2) - 1];
    const b = w.points[Math.floor(w.points.length / 2)];
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const halfW = w.width / 2;
    geom = {
      centre: w.contains(mx, my),
      justInside: w.contains(mx + nx * (halfW - 4), my + ny * (halfW - 4)),
      justOutside: w.contains(mx + nx * (halfW + 10), my + ny * (halfW + 10)),
      farOff: w.contains(mx + nx * 400, my + ny * 400),
    };
  }
  // The trail must start BEHIND the craft, never ahead of it.
  const head = w?.points[w.points.length - 1];
  const behind = head
    ? ((head.x - h.x) * Math.cos(h._heading) + (head.y - h.y) * Math.sin(h._heading)) < 0
    : false;
  return { parkedPts, geom, behind, live: (w?.points.length ?? 0) };
}));
check(wake.parkedPts === 0, 'NO MOVEMENT, NO WAKE — a parked craft carves nothing', `${wake.parkedPts}`);
check(wake.live > 2, 'and a committed pass lays one', `${wake.live} points`);
check(wake.behind, 'the trail is emitted BEHIND the craft, never ahead of it', '');
check(wake.geom?.centre === true && wake.geom?.justInside === true,
  'the wake damages the region it draws', JSON.stringify(wake.geom));
check(wake.geom?.justOutside === false && wake.geom?.farOff === false,
  'AND NOTHING ELSE — the shape is the hit test', JSON.stringify(wake.geom));

// ── 4. Cleanup, in every direction ─────────────────────────────────────────
const clean = await run('?nodlg=1&champdbg=harrower&room=hangar&sector=6', async (page) => page.evaluate(async () => {
  const { ROOMS } = await import('/src/data/rooms.js');
  const { setGodMode } = await import('/src/systems/debug.js');
  setGodMode(true);
  const gs = window.game.scene.getScene('Game');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const live = async () => {
    let h = gs.enemies.getChildren().find((e) => e.alive && e.isChampion);
    if (!h) h = gs.spawnChampion(gs.player.x + 420, gs.player.y);
    for (let i = 0; i < 300; i++) { await wait(50); if ((h.wake?.length ?? 0) > 120) break; }
    return h;
  };
  const h1 = await live();
  const beforeDeath = gs._hazards.length;
  h1.damage(999999);
  await wait(300);
  const afterDeath = gs._hazards.length;

  const h2 = await live();
  const beforeRoom = gs._hazards.length;
  gs.loadRoom(ROOMS.find((r) => r.id === 'detention'));
  await wait(1100);
  const afterRoom = gs._hazards.length;

  const h3 = await live();
  h3.retireWake(); h3.retireWake();          // idempotent, twice on purpose
  const afterRetire = gs._hazards.filter((x) => !x.dead).length;
  return { beforeDeath, afterDeath, beforeRoom, afterRoom, afterRetire };
}));
check(clean.beforeDeath >= 1 && clean.afterDeath === 0,
  'THE WAKE DIES WITH THE CRAFT — no damaging region whose author is gone',
  `${clean.beforeDeath} -> ${clean.afterDeath}`);
check(clean.beforeRoom >= 1 && clean.afterRoom === 0, 'a room change sweeps it',
  `${clean.beforeRoom} -> ${clean.afterRoom}`);
check(clean.afterRetire === 0, 'and retiring it twice is a no-op, not a crash', `${clean.afterRetire}`);

// ── 5. The negative half ───────────────────────────────────────────────────
const off = await run('?nodlg=1', async (page) => page.evaluate(async () => {
  const { isChampDebug } = await import('/src/systems/debug.js');
  const gs = window.game.scene.getScene('Game');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let seen = 0;
  for (let w = 0; w < 3; w++) { gs._startWave(w); await wait(700); seen += gs.enemies.getChildren().filter((e) => e.isChampion).length; }
  return { dbg: isChampDebug(), seen, injected: gs._maybeInjectChampion({ count: 8 }) };
}));
check(off.dbg === false && off.seen === 0,
  'NORMAL ENDLESS SPAWNS NO CHAMPION across three real waves', `${off.seen}`);
check(off.injected === null, 'and the injector refuses without the flag', `${off.injected}`);

// ── 6. Frozen neighbours ───────────────────────────────────────────────────
const frozen = await run('?nodlg=1&champdbg=harrower', async (page) => page.evaluate(async () => {
  const { ENCOUNTERS, ENCOUNTER_PLAN } = await import('/src/data/encounters.js');
  const { NEMESIS_MOVES, KITS } = await import('/src/data/nemesisMoves.js');
  const { ROOMS } = await import('/src/data/rooms.js');
  const gs = window.game.scene.getScene('Game');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  gs.loadRoom(ROOMS.find((r) => r.boss));
  await wait(900);
  const bossInject = gs._maybeInjectChampion({ count: 8 });
  const bossChamps = gs.enemies.getChildren().filter((e) => e.isChampion).length;
  return {
    bossInject, bossChamps,
    duelInject: gs._maybeInjectChampion({ miniBoss: true, count: 8 }),
    encounters: Object.keys(ENCOUNTERS).length,
    plan: Object.keys(ENCOUNTER_PLAN).sort().join(','),
    nem: `${NEMESIS_MOVES.length}/${Object.keys(KITS).length}`,
  };
}));
check(frozen.bossInject === null && frozen.bossChamps === 0,
  'the boss room is untouched, flag or no flag', `${frozen.bossChamps}`);
check(frozen.duelInject === null, 'and the Nemesis duel wave is untouched', '');
check(frozen.encounters === 6 && frozen.plan === 'corridor,detention,hangar',
  'PHASE A IS UNCHANGED — six approved archetypes, three planned arenas', frozen.plan);
check(frozen.nem === '14/5', 'NEMESIS IS UNCHANGED — 14 moves, 5 kits', frozen.nem);

await browser.close();
for (const c of checks) console.log(`  ${c.ok ? 'ok  ' : 'FAIL'}  ${c.label}${c.ok || !c.detail ? '' : ' — ' + c.detail}`);
const failed = checks.filter((c) => !c.ok);
if (failed.length) fail(`${failed.length} of ${checks.length} checks failed: ${failed.map((f) => f.label).join('; ')}`);
console.log(`PASS: ${checks.length} checks — the Harrower moves, carves only by moving, cleans up, and is debug-only`);
