// DIAG — IS THE SHOCK CAPTAIN SLUGGISH, AND IS HIS BURST FREE TO WALK OUT OF?
//
//   node tests/diag-captain-pressure.mjs [mode]
//        mode = hold (default) | line | reverse | still
//
// Two handset findings, one instrument. §7 says audit the values before tuning
// them and §13 says measure the cadence before touching it, so this prints:
//
//   MOBILITY  what fraction of the fight he is a statue, how long after a burst
//             ends before he is moving again, and the lateral speed he reaches.
//   PRESSURE  for every bolt he fires, the CLOSEST it ever came to the player —
//             which is the only honest way to ask whether holding one direction
//             is a free answer, because a bolt that misses by 200px and one that
//             misses by 8px are the same miss on a hit counter.
//
// The player is driven by the harness on a fixed policy so the modes are
// comparable: `hold` orbits (the perpendicular re-solved every frame, which is
// what a player circling an enemy actually does), `line` locks ONE world
// bearing and walks it — the literal "keep holding sideways" — `reverse` flips
// every 700ms, and `still` stands.
//
// THE TWO MOVING MODES ARE NOT INTERCHANGEABLE, AND THE DIFFERENCE IS THE
// POINT. A lead is a straight-line extrapolation: it is exactly right about
// `line` and systematically OVER-shoots a curve, so measuring only the orbit
// credits the prediction with less than it does and measuring only the line
// credits it with more. Prediction is fair exactly when both moving modes stop
// being safe and `reverse` stays safe.
//
// ── THE ONE WAY THIS INSTRUMENT LIES, AND IT IS A FRAME-RATE LIE ───────────
// Closest approach is sampled on `postupdate`, and this harness runs at ~14fps
// against a 600px/s bolt — so the bolt jumps ~43px BETWEEN SAMPLES and the true
// nearest point can be missed by up to half of that. A stationary player, whom
// he cannot fail to hit, still measures a ~44px median miss here. So read the
// buckets as ORDERING, never as absolutes: `<=48px` is "would have hit", and
// the same noise is in every mode and in every build, which is what keeps a
// before/after comparison honest.
//
// AND EVERY ROUND HERE IS A SMALL SAMPLE — six bolts per burst position over 24
// seconds. Two `hold` runs disagreed about which round of the burst was the
// most accurate. Read the AGGREGATE (how many of all bolts came inside 48px)
// and treat the per-round split as colour.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const MODE = process.argv[2] || 'hold';
const SECS = Number(process.argv[3] || 26);
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const browser = await chromium.launch({ executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
page.on('pageerror', (e) => console.error('PAGE ERROR', e));

await page.goto('http://localhost:5173/?nodlg=1&nofreeze=1&champdbg=1&room=hangar&sector=8');
await page.waitForTimeout(4500);
await page.mouse.click(360, 640);
await page.waitForTimeout(800);
await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 606 }));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(3000);

const out = await page.evaluate(async ({ MODE, SECS }) => {
  const gs = window.game.scene.getScene('Game');
  const { setGodMode } = await import('/src/systems/debug.js');
  setGodMode(true);
  gs.lives = 9999;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // A CLEAN FLOOR. The question is the Captain's own pressure, and a wave of
  // troopers between him and the player answers a different one.
  gs.enemies.getChildren().filter((e) => e.alive && !e.isChampion)
    .forEach((e) => gs._destroyEnemyFully?.(e) ?? e.destroy());
  gs.arenaActive = false;
  // AND A CLEAR LINE. The first build of this rig ran in a furnished hangar and
  // the numbers were nonsense: bolts died on cover a third of the way to the
  // player, so their "closest approach" was a point they passed mid-flight, and
  // rounds 2 and 3 appeared to be over-leading by 180px when they were simply
  // hitting a crate. The question here is AIM, and aim is not measurable
  // through a console. Cover comes back for the visual pass, which is where
  // fighting around it is the point.
  gs.walls.getChildren().slice().forEach((w) => w.destroy());
  gs.navGrid?.build?.(gs.physics.world.bounds.width, gs.physics.world.bounds.height, []);

  let c = gs.enemies.getChildren().find((e) => e.alive && e.isChampion);
  if (!c) c = gs.spawnChampion(gs.player.x + 420, gs.player.y, 'captain');
  c.die = () => { c.hp = Math.max(c.hp, c.hpMax * 0.5); };

  const L = {
    frames: 0, dt: 0, stationary: 0, moving: 0,
    states: {}, speeds: [], lateral: [],
    bolts: [], recoverToMove: [], burstEnds: 0,
    dists: [],
  };
  // WHAT HE AIMED AT, AND WHAT ACTUALLY HAPPENED. A closest-approach figure
  // alone cannot tell an over-lead from a geometric impossibility — a bolt
  // chasing a retreating player never arrives however perfectly it was aimed.
  // So record the aim point the solver produced and the player's REAL position
  // at the bolt's closest approach, and print the two displacements side by
  // side: `wanted` is how far ahead he led, `real` is how far they went.
  const leads = [];
  const realPredict = c._predict.bind(c);
  c._predict = (p, lead) => {
    const aim = realPredict(p, lead);
    leads.push({ lead, px: p.x, py: p.y, ax: aim.x, ay: aim.y });
    return aim;
  };
  const live = [];           // bolts in flight: { b, min, t0, dist0, travel }
  const realFire = gs.fireCaptainBolt.bind(gs);
  gs.fireCaptainBolt = (cap, mx, my, ang) => {
    const b = realFire(cap, mx, my, ang);
    const p = gs.player;
    const lead = leads[leads.length - 1];
    live.push({
      b, min: Infinity, t0: performance.now(),
      dist0: Math.hypot(p.x - mx, p.y - my),
      round: cap.def.burstRounds - cap._round + 1,
      px0: p.x, py0: p.y,
      pv: Math.hypot(p.body.velocity.x, p.body.velocity.y),
      wanted: lead ? Math.hypot(lead.ax - lead.px, lead.ay - lead.py) : 0,
      real: 0,
    });
    return b;
  };

  let pendingRecover = null;
  let lastCap = null;
  const t0 = performance.now();
  let flip = 0, dir = 1, lockA = null, anchor = null;
  L.wallTurns = 0;

  const hook = () => {
    if (!c.alive) return;
    const p = gs.player;
    const now = performance.now();
    const dt = gs.game.loop.delta;
    L.frames++; L.dt += dt;

    // ── drive the player on a fixed policy ────────────────────────────────
    if (MODE !== 'still') {
      flip += dt;
      if (MODE === 'reverse' && flip > 700) { flip = 0; dir *= -1; }
      let a;
      if (MODE === 'line') {
        // ONE WORLD BEARING, HELD, INSIDE A PATROL BAND.
        //
        // The first version walked the locked bearing until the arena wall and
        // it measured the wrong thing: the player crossed the whole room, the
        // Captain spent 18 of 24 seconds chasing, and the three bursts he did
        // open were fired into walls at extreme range. A straight line across
        // a 1600px arena is not "the player kept strafing", it is "the player
        // left".
        //
        // 440px of travel before reversing is longer than a whole burst plus
        // its flight time (~1.1s against ~2.3s of travel), so nearly every
        // round still meets a player on a straight line, while the engagement
        // stays inside the band the burst is designed for. A reversal the RIG
        // imposes is not the player changing their mind, so they are counted
        // and reported.
        if (lockA === null) {
          lockA = Math.atan2(p.y - c.y, p.x - c.x) + Math.PI / 2;
          anchor = { x: p.x, y: p.y };
        }
        // AND EACH NEW LEG IS RE-DERIVED PERPENDICULAR, not simply reversed.
        // Reversing keeps the bearing fixed in the world while the Captain
        // moves, so within a few legs "perpendicular" has become "straight
        // away from him" — and a bolt at 600px/s chasing a player at 380px/s
        // never arrives, which measures the geometry of a retreat rather than
        // the accuracy of a lead. Measured: rounds 2 and 3 "missed" by 364 and
        // 375px, both larger than `leadMaxPx` can even displace an aim point,
        // which is what gave the confound away.
        if (Math.hypot(p.x - anchor.x, p.y - anchor.y) > 440) {
          lockA = Math.atan2(p.y - c.y, p.x - c.x)
            + Math.PI / 2 * (Math.random() < 0.5 ? 1 : -1);
          anchor = { x: p.x, y: p.y };
          L.wallTurns++;
        }
        a = lockA;
      } else {
        // Perpendicular to the bearing FROM the captain: a lateral orbit.
        a = Math.atan2(p.y - c.y, p.x - c.x) + Math.PI / 2 * dir;
      }
      p.setMoveInput({ x: Math.cos(a), y: Math.sin(a), force: 1 });
    } else {
      p.setMoveInput({ x: 0, y: 0, force: 0 });
    }

    // ── mobility ──────────────────────────────────────────────────────────
    const v = Math.hypot(c.body.velocity.x, c.body.velocity.y);
    L.states[c._cap] = (L.states[c._cap] || 0) + dt;
    if (v < 20) L.stationary += dt; else { L.moving += dt; L.speeds.push(v); }
    if (lastCap === 'burst' && c._cap !== 'burst') { pendingRecover = now; L.burstEnds++; }
    if (pendingRecover && v > 60) { L.recoverToMove.push(now - pendingRecover); pendingRecover = null; }
    lastCap = c._cap;
    L.dists.push(Math.hypot(p.x - c.x, p.y - c.y));

    // ── every bolt's closest approach ─────────────────────────────────────
    for (let i = live.length - 1; i >= 0; i--) {
      const e = live[i];
      const b = e.b;
      if (!b || !b.active) {
        e.travel = now - e.t0;
        L.bolts.push({ min: Math.round(e.min), dist0: Math.round(e.dist0),
          travel: Math.round(e.travel), round: e.round,
          wanted: Math.round(e.wanted), real: Math.round(e.real),
          pv: Math.round(e.pv) });
        live.splice(i, 1);
        continue;
      }
      const d = Math.hypot(p.x - b.x, p.y - b.y);
      if (d < e.min) {
        e.min = d;
        // The displacement the player had ACTUALLY made by the moment the bolt
        // was nearest them — the number the lead was trying to be.
        e.real = Math.hypot(p.x - e.px0, p.y - e.py0);
      }
    }
  };
  gs.events.on('postupdate', hook);
  await wait(SECS * 1000);
  gs.events.off('postupdate', hook);

  const med = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
  return {
    mode: MODE,
    seconds: Math.round(L.dt) / 1000,
    fps: Math.round(L.frames / (L.dt / 1000)),
    stationaryPct: Math.round(100 * L.stationary / L.dt),
    states: Object.fromEntries(Object.entries(L.states).map(([k, v]) => [k, Math.round(v)])),
    medSpeed: Math.round(med(L.speeds)),
    maxSpeed: Math.round(Math.max(0, ...L.speeds)),
    burstEnds: L.burstEnds,
    recoverToMoveMs: L.recoverToMove.map(Math.round),
    medRecoverToMove: Math.round(med(L.recoverToMove)),
    medRange: Math.round(med(L.dists)),
    bolts: L.bolts,
    wallTurns: L.wallTurns,
    cfgSpeed: c.cfg.speed,
  };
}, { MODE, SECS });

const b = out.bolts;
const near = (n) => b.filter((x) => x.min <= n).length;
console.log(`mode=${out.mode}  ${out.seconds}s @ ${out.fps}fps   median range ${out.medRange}px`
  + (out.mode === 'line' ? `   (${out.wallTurns} rig-forced reversals)` : ''));
console.log('');
console.log('MOBILITY');
console.log(`  stationary          ${out.stationaryPct}% of the fight`);
console.log(`  state ms            ${JSON.stringify(out.states)}`);
console.log(`  speed               median ${out.medSpeed} / peak ${out.maxSpeed} (cfg ${out.cfgSpeed})`);
console.log(`  burst end -> moving ${out.medRecoverToMove}ms median  ${JSON.stringify(out.recoverToMoveMs)}`);
console.log('');
console.log('PRESSURE');
console.log(`  bolts fired         ${b.length}`);
console.log(`  travel time         median ${b.length ? [...b].map((x) => x.travel).sort((a, c) => a - c)[b.length >> 1] : 0}ms`);
console.log(`  closest approach    <=24px ${near(24)}   <=48px ${near(48)}   <=96px ${near(96)}   <=160px ${near(160)}`);
for (const r of [1, 2, 3]) {
  const rr = b.filter((x) => x.round === r);
  if (!rr.length) continue;
  const mins = rr.map((x) => x.min).sort((a, c) => a - c);
  const md = (f) => { const v = rr.map(f).sort((a, c) => a - c); return v[v.length >> 1]; };
  console.log(`  round ${r}: n=${rr.length}  median miss ${mins[mins.length >> 1]}px  best ${mins[0]}px`
    + `   led ${md((x) => x.wanted)}px vs actual ${md((x) => x.real)}px`
    + `   [range ${md((x) => x.dist0)}px, player ${md((x) => x.pv)}px/s]`);
}
// RAW=1 dumps every bolt row. The medians above mix engagement ranges and the
// per-round split is a 4-6 sample; when a figure looks impossible, read these.
if (process.env.RAW) console.log(JSON.stringify(out.bolts));
await browser.close();
