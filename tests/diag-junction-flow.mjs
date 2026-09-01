// DIAGNOSTIC — REACTOR JUNCTION ENEMY FLOW.
//
//   node tests/diag-junction-flow.mjs
//
// The topology diagnostic measures the ROOM. This one measures what actually
// happens when a wave walks through it: real enemies, real pathing, real
// bodies, spawned at all three feeder gates at once against a player standing
// on the objective.
//
// PER-ENEMY METRICS, sampled from inside the page on `postupdate`:
//   detour   distance travelled / straight-line distance, over the APPROACH
//            ONLY — each tracker freezes the first frame the enemy gets within
//            260px of the player. Measured over the whole run instead, it just
//            counts circle-strafing once an enemy arrives and says nothing
//            about the room; that first version returned 2.7-4.1 with no
//            stable ordering between candidates.
//   stalled  fraction of approach frames moving slower than 40px/s. The enemy
//            wanted to close and did not: the queueing/orbiting symptom.
//   contacts fraction of approach frames with the body touching something.
//   arrived  reached the 260px ring at all, and how long it took.
//
// The player is FROZEN on the objective and made unkillable so the measurement
// is about the room and not about a fight.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';

const URL = 'http://localhost:5173/?nodlg=1&nofreeze=1';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const browser = await chromium.launch({ executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
page.on('pageerror', (e) => console.error('PAGE ERROR', e));

await page.goto(URL);
await page.waitForTimeout(4500);
await page.mouse.click(360, 640);
await page.waitForTimeout(800);
await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 909 }));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(1500);

const RING = [
  { x: 700, y: 420, tex: 'ch-con-heavy' }, { x: 700, y: 980, tex: 'rj-cab-a' },
  { x: 420, y: 700, tex: 'ch-con-ped-b' }, { x: 980, y: 700, tex: 'ch-con-ped-a' },
  { x: 500, y: 500, tex: 'rj-cab-b' }, { x: 900, y: 500, tex: 'rj-cab-a' },
  { x: 500, y: 900, tex: 'rj-cab-b' }, { x: 900, y: 900, tex: 'rj-cab-a' },
];

const CANDIDATES = {
  // THE SHIPPED RING, as a literal. Reading it from the spec would make this
  // instrument agree with whatever the spec currently says and stop being a
  // baseline the moment the topology changed.
  baseline: RING,
  A: [
    { x: 920, y: 280,  tex: 'ch-con-heavy' },
    { x: 280, y: 920,  tex: 'rj-cab-b' },
    { x: 440, y: 1160, tex: 'rj-cab-a' },
    { x: 1080, y: 920, tex: 'ch-con-ped-a' },
  ],
  B: [
    { x: 920, y: 280,  tex: 'ch-con-heavy' },
    { x: 280, y: 920,  tex: 'rj-cab-b' },
    { x: 440, y: 1160, tex: 'rj-cab-a' },
    { x: 1080, y: 920, tex: 'ch-con-ped-a' },
    { x: 780, y: 1080, tex: 'rj-cab-b' },
  ],
  // WHAT IS ACTUALLY SHIPPED. Candidate A with its north piece pulled in to
  // the crossing's corner, so the four radii are genuinely uneven.
  final: null,
};

// PER GATE. `density` grunts + shooters land in a loose blob at each of the
// three feeder gates, which is the multi-direction crowd the brief asks for.
const run = async (name, cover, density, ms) => {
  await page.evaluate(async ({ cover }) => {
    const gs = window.game.scene.getScene('Game');
    const { ROOMS } = await import('/src/data/rooms.js');
    const { snapAll } = await import('/src/data/mapUtils.js');
    const base = ROOMS.find((r) => r.id === 'corridor');
    gs.loadRoom(cover ? { ...base, cover: snapAll(cover) } : base);
    await new Promise((r) => setTimeout(r, 1800));
    gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
    gs._sectorTint?.setAlpha(0);
  }, { cover });

  await page.evaluate(({ density }) => {
    const gs = window.game.scene.getScene('Game');
    const spec = { x: 700, y: 700 };
    gs.player.setPosition(spec.x, spec.y);
    gs.player.hp = 1e9; gs.player.hpMax = 1e9; gs.lives = 9999;
    gs.arenaActive = true;

    const gates = [{ x: 700, y: 100 }, { x: 100, y: 700 }, { x: 1300, y: 700 }];
    window.__flow = { track: new Map(), frames: 0 };
    gates.forEach((g, gi) => {
      for (let i = 0; i < density; i++) {
        const e = gs.spawnEnemyAt(i % 3 === 2 ? 'shooter' : 'grunt',
          g.x + ((i * 61) % 140) - 70, g.y + ((i * 43) % 140) - 70, {});
        if (e) window.__flow.track.set(e, { gate: gi, x0: e.x, y0: e.y, px: e.x, py: e.y,
          dist: 0, slow: 0, hit: 0, n: 0, near: 1e9, done: false, t: 0 });
      }
    });

    window.__flowHook = () => {
      const f = window.__flow; f.frames++;
      // Pin the player: this measures the room, not a chase.
      gs.player.setPosition(700, 700);
      gs.player.body.setVelocity(0, 0);
      gs.player.hp = gs.player.hpMax;
      for (const [e, t] of f.track) {
        if (!e.active || t.done) continue;
        const d = Math.hypot(e.x - t.px, e.y - t.py);
        t.dist += d; t.px = e.x; t.py = e.y; t.n++; t.t += 16.7;
        const sp = Math.hypot(e.body?.velocity.x ?? 0, e.body?.velocity.y ?? 0);
        const b = e.body;
        if (b && (b.touching.none === false || b.blocked.none === false)) t.hit++;
        if (sp < 40) t.slow++;
        const toP = Math.hypot(e.x - 700, e.y - 700);
        t.near = Math.min(t.near, toP);
        // THE APPROACH ENDS AT THE 260px RING. Everything after it is combat.
        if (toP < 260) t.done = true;
      }
    };
    gs.events.on('postupdate', window.__flowHook);
  }, { density });

  await page.waitForTimeout(ms);

  const m = await page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    gs.events.off('postupdate', window.__flowHook);
    const rows = [];
    for (const [e, t] of window.__flow.track) {
      // Straight line is spawn -> the ring, not spawn -> where it stopped.
      const straight = Math.max(1, Math.hypot(700 - t.x0, 700 - t.y0) - 260);
      if (t.n < 10) continue;
      rows.push({ gate: t.gate, detour: t.dist / straight, stalled: t.slow / t.n,
        contacts: t.hit / t.n, arrived: t.done, ms: t.t });
    }
    const avg = (f) => rows.length ? rows.reduce((s, r) => s + f(r), 0) / rows.length : 0;
    const byGate = [0, 1, 2].map((g) => {
      const r = rows.filter((x) => x.gate === g);
      return r.length ? +(r.reduce((s, x) => s + x.detour, 0) / r.length).toFixed(3) : null;
    });
    gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
    return {
      tracked: rows.length,
      detour: +avg((r) => r.detour).toFixed(3),
      worstDetour: +Math.max(...rows.map((r) => r.detour)).toFixed(3),
      stalled: +(100 * avg((r) => r.stalled)).toFixed(1),
      contacts: +(100 * avg((r) => r.contacts)).toFixed(1),
      arrived: +(100 * rows.filter((r) => r.arrived).length / rows.length).toFixed(0),
      arriveMs: Math.round(avg((r) => r.ms)),
      byGate,
    };
  });
  return { name, density, ...m };
};

const out = [];
for (const dens of [4, 8]) {
  for (const [name, cover] of Object.entries(CANDIDATES)) {
    const m = await run(name, cover, dens, 9000);
    out.push(m);
    console.log(`${(name + ' x' + dens).padEnd(14)} tracked ${String(m.tracked).padStart(2)}  detour ${m.detour}  worst ${m.worstDetour}  stalled ${String(m.stalled).padStart(5)}%  contact ${String(m.contacts).padStart(5)}%  arrived ${m.arrived}% in ${m.arriveMs}ms  by gate N/W/E ${m.byGate.join(' / ')}`);
  }
  console.log('');
}
writeFileSync('docs/evidence/arena-pilot/junction-flow.json', JSON.stringify(out, null, 2));
console.log('wrote docs/evidence/arena-pilot/junction-flow.json');
await browser.close();
