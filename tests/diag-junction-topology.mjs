// DIAGNOSTIC — REACTOR JUNCTION COVER TOPOLOGY.
//
//   node tests/diag-junction-topology.mjs
//
// Loads the junction repeatedly with different cover lists and measures the
// room rather than the art. `GameScene.loadRoom` takes a SPEC OBJECT, so a
// candidate topology is a cloned spec with a different `cover` array — no
// source edit, no rebuild, and every candidate is measured by the same code on
// the same machine within seconds of the others.
//
// THE METRICS ARE ACTOR-DERIVED, NOT EYEBALLED:
//   VADER_D  112  BOSS.radius 56, doubled — the largest body in the game.
//   INFLATE   23  NavGrid's own agent clearance (NavGrid.js:31).
//   LANE     158  VADER_D + 2*INFLATE — the narrowest gap the nav grid's own
//                 assumptions say the largest actor can be routed through.
//                 Rounded to 160 = two nav cells, so a qualifying gap always
//                 contains at least one fully walkable cell.
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

// ── The candidates. `snapAll` is applied in-page so these read as authored
//    coordinates, exactly like the spec does.
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
  baseline: RING, // the shipped eight-cover ring, read from the spec itself
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

const measure = async (name, cover) => page.evaluate(async ({ name, cover }) => {
  const gs = window.game.scene.getScene('Game');
  const { ROOMS } = await import('/src/data/rooms.js');
  const { snapAll } = await import('/src/data/mapUtils.js');
  const base = ROOMS.find((r) => r.id === 'corridor');
  const spec = cover ? { ...base, cover: snapAll(cover) } : base;

  const t0 = performance.now();
  gs.loadRoom(spec);
  const loadMs = performance.now() - t0;
  await new Promise((r) => setTimeout(r, 1800));

  const VADER_R = 56, LANE = 160;
  const OBJ = spec.terminals[0];

  // Every SOLID body in the room, as a rect. Walls group holds the perimeter
  // blast-door tiles, the cover consoles and the solid props alike.
  const rects = gs.walls.getChildren().filter((o) => o.active && o.body).map((o) => ({
    x: o.body.x, y: o.body.y, w: o.body.width, h: o.body.height,
    cx: o.body.x + o.body.width / 2, cy: o.body.y + o.body.height / 2,
    tex: o.texture?.key,
  }));
  // Interior obstacles only — the perimeter tiles are not topology.
  const inner = rects.filter((r) => r.cx > 60 && r.cx < spec.bounds.w - 60
                                 && r.cy > 60 && r.cy < spec.bounds.h - 60);

  const gap = (a, b) => Math.max(
    Math.abs(a.cx - b.cx) - (a.w + b.w) / 2,
    Math.abs(a.cy - b.cy) - (a.h + b.h) / 2);

  // Pairwise gaps between interior obstacles.
  const pairs = [];
  for (let i = 0; i < inner.length; i++)
    for (let j = i + 1; j < inner.length; j++)
      pairs.push({ a: inner[i].tex, b: inner[j].tex, g: Math.round(gap(inner[i], inner[j])) });
  pairs.sort((p, q) => p.g - q.g);
  const chokes = pairs.filter((p) => p.g > 0 && p.g < LANE);

  // Distance from the objective to the nearest face of each interior body.
  const distToRect = (px, py, r) => {
    const dx = Math.max(r.x - px, 0, px - (r.x + r.w));
    const dy = Math.max(r.y - py, 0, py - (r.y + r.h));
    return Math.hypot(dx, dy);
  };
  const clearR = Math.round(Math.min(...inner.map((r) => distToRect(OBJ.x, OBJ.y, r))));

  // How much of the room the LARGEST actor can actually stand in. A point is
  // Vader-admissible when a circle of BOSS.radius centred there clears every
  // body. Sampled on a 20px lattice over the interior.
  let admit = 0, total = 0, admitCentre = 0, totalCentre = 0;
  const CROSS = { x0: 400, y0: 400, x1: 1000, y1: 1000 };
  for (let px = 120; px <= spec.bounds.w - 120; px += 20) {
    for (let py = 120; py <= spec.bounds.h - 120; py += 20) {
      const ok = rects.every((r) => distToRect(px, py, r) >= VADER_R);
      total++; if (ok) admit++;
      if (px >= CROSS.x0 && px <= CROSS.x1 && py >= CROSS.y0 && py <= CROSS.y1) {
        totalCentre++; if (ok) admitCentre++;
      }
    }
  }

  // Cover bodies parked inside the room's own authored open crossing.
  const inCrossing = inner.filter((r) => r.x < CROSS.x1 && r.x + r.w > CROSS.x0
                                      && r.y < CROSS.y1 && r.y + r.h > CROSS.y0).length;

  // NAV: every feeder gate and the spawn, routed to the objective and to the
  // far side of it. Ratio is path length over straight line.
  const routeLen = (a, b) => {
    const p = gs.navGrid.findPath(a.x, a.y, b.x, b.y);
    let L = 0, prev = a;
    for (const n of p) { L += Math.hypot(n.x - prev.x, n.y - prev.y); prev = n; }
    return L;
  };
  const opposite = (g) => ({ x: 2 * OBJ.x - g.x, y: 2 * OBJ.y - g.y });
  const routes = [...spec.gates, spec.spawn].map((g, i) => ({
    from: i < spec.gates.length ? `gate${i}` : 'spawn',
    toObj: +(routeLen(g, OBJ) / Math.hypot(g.x - OBJ.x, g.y - OBJ.y)).toFixed(3),
    toFar: +(routeLen(g, opposite(g)) / Math.hypot(2 * (g.x - OBJ.x), 2 * (g.y - OBJ.y))).toFixed(3),
  }));
  routes.push({ from: 'spawn->exit',
    toObj: +(routeLen(spec.spawn, spec.exit) / Math.hypot(spec.spawn.x - spec.exit.x, spec.spawn.y - spec.exit.y)).toFixed(3),
    toFar: 0 });

  return {
    name,
    covers: spec.cover.length,
    bodies: gs.walls.getChildren().filter((o) => o.active && o.body).length,
    innerBodies: inner.length,
    display: gs.children.list.length,
    envParts: gs.envLight?.parts?.length ?? 0,
    loadMs: +loadMs.toFixed(1),
    clearR,
    inCrossing,
    minGap: pairs[0]?.g,
    chokes: chokes.map((c) => `${c.a}|${c.b} ${c.g}px`),
    vaderArea: +(100 * admit / total).toFixed(1),
    vaderCentre: +(100 * admitCentre / totalCentre).toFixed(1),
    routes,
  };
}, { name, cover });

const out = [];
for (const [name, cover] of Object.entries(CANDIDATES)) {
  const m = await measure(name, cover);
  out.push(m);
  console.log(`\n── ${name} ${'─'.repeat(56)}`);
  console.log(`  cover ${m.covers}  interior bodies ${m.innerBodies}  wall bodies ${m.bodies}`);
  console.log(`  display ${m.display}  envLight parts ${m.envParts}  load ${m.loadMs}ms`);
  console.log(`  clear radius at objective   ${m.clearR}px`);
  console.log(`  cover bodies in the crossing ${m.inCrossing}`);
  console.log(`  min obstacle gap            ${m.minGap}px`);
  console.log(`  sub-lane chokes (<160px)    ${m.chokes.length}${m.chokes.length ? ' — ' + m.chokes.join(', ') : ''}`);
  console.log(`  Vader-admissible room       ${m.vaderArea}%   crossing ${m.vaderCentre}%`);
  for (const r of m.routes) console.log(`  route ${r.from.padEnd(12)} ->objective ${r.toObj}  ->far side ${r.toFar || '-'}`);
}
writeFileSync('docs/evidence/arena-pilot/junction-topology.json', JSON.stringify(out, null, 2));
console.log('\nwrote docs/evidence/arena-pilot/junction-topology.json');
await browser.close();
