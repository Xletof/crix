// DIAGNOSTIC — REACTOR JUNCTION, VADER AS THE NAVIGATION BENCHMARK.
//
//   node tests/diag-junction-vader.mjs
//
// §12: Vader is frozen and is the instrument, not the subject. The question is
// only whether the ROOM lets his existing movement vocabulary work.
//
// He is the largest body in the game (BOSS.radius 56, so Ø112) and the eight
// -cover ring's tightest gaps measured 90px, which he physically cannot enter
// while the nav grid — which tests a cell CENTRE against a body rect + 23px —
// happily routes small actors through them. That mismatch is what "operating
// around furniture" looks like from the inside.
//
// PER LEG: he is placed at a start station, the player is pinned at a target
// station, his own AI drives, and the leg is measured until he closes to 200px
// or 6s elapse.
//   detour    travelled / straight-line
//   stalled   fraction of frames under 60px/s
//   contacts  fraction of frames with his body touching geometry
//   closed    did he reach the 200px ring
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

// Legs chosen to cross the room, not to hug a wall: each one runs through or
// past the objective, which is where the ring used to be.
const LEGS = [
  ['N->S', 700, 300, 700, 1100],
  ['W->E', 300, 700, 1100, 700],
  ['NW->SE', 380, 380, 1020, 1020],
  ['NE->SW', 1020, 380, 380, 1020],
  ['gateW->obj', 200, 700, 700, 700],
  ['gateN->obj', 700, 200, 700, 700],
  ['gateE->obj', 1200, 700, 700, 700],
  ['obj->spawn', 700, 700, 260, 1200],
];

const load = (cover) => page.evaluate(async ({ cover }) => {
  const gs = window.game.scene.getScene('Game');
  const { ROOMS } = await import('/src/data/rooms.js');
  const { snapAll } = await import('/src/data/mapUtils.js');
  const { ENDLESS } = await import('/src/config.js');
  const base = ROOMS.find((r) => r.id === 'corridor');
  gs.sector = 6 * ENDLESS.bossEvery;
  gs.loadRoom(cover ? { ...base, cover: snapAll(cover) } : base);
  await new Promise((r) => setTimeout(r, 1800));
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  gs.arenaActive = false;
  gs._sectorTint?.setAlpha(0);
  if (!gs.boss?.alive) { gs.spawnBoss(700, 500); await new Promise((r) => setTimeout(r, 1200)); }
  gs.player.hp = 1e9; gs.player.hpMax = 1e9; gs.lives = 9999;
}, { cover });

// SILENCE THE SCHEDULER, NOT THE STATE MACHINE. His scripted moves teleport and
// dash him about, which would measure the move rather than the room; his
// ordinary pursuit is exactly what is under test and stays live.
const leg = (name, bx, by, px, py) => page.evaluate(async ({ name, bx, by, px, py }) => {
  const gs = window.game.scene.getScene('Game'), b = gs.boss, F = 1e9;
  b._blackoutT = F; b._afterimageT = F; b._disarmT = F; b._sunderT = F;
  b._reflectT = F; b._moveT = F;
  b.hp = b.hpMax; b.setPosition(bx, by); b.body.reset(bx, by);
  gs.player.setPosition(px, py);

  const t = { dist: 0, slow: 0, hit: 0, n: 0, px: bx, py: by, closed: false, ms: 0 };
  const hook = () => {
    gs.player.setPosition(px, py); gs.player.body.setVelocity(0, 0);
    gs.player.hp = gs.player.hpMax;
    if (t.closed) return;
    t.dist += Math.hypot(b.x - t.px, b.y - t.py); t.px = b.x; t.py = b.y; t.n++; t.ms += 16.7;
    const sp = Math.hypot(b.body.velocity.x, b.body.velocity.y);
    if (sp < 60) t.slow++;
    if (b.body.touching.none === false || b.body.blocked.none === false) t.hit++;
    if (Math.hypot(b.x - px, b.y - py) < 200) t.closed = true;
  };
  gs.events.on('postupdate', hook);
  await new Promise((r) => setTimeout(r, 6000));
  gs.events.off('postupdate', hook);

  const straight = Math.max(1, Math.hypot(px - bx, py - by) - 200);
  return { name, detour: +(t.dist / straight).toFixed(3), stalled: +(100 * t.slow / t.n).toFixed(1),
    contacts: +(100 * t.hit / t.n).toFixed(1), closed: t.closed, ms: Math.round(t.ms) };
}, { name, bx, by, px, py });

const out = [];
for (const [name, cover] of Object.entries(CANDIDATES)) {
  await load(cover);
  const rows = [];
  for (const L of LEGS) rows.push(await leg(...L));
  const avg = (f) => rows.reduce((s, r) => s + f(r), 0) / rows.length;
  const sum = { name, detour: +avg((r) => r.detour).toFixed(3), stalled: +avg((r) => r.stalled).toFixed(1),
    contacts: +avg((r) => r.contacts).toFixed(1), closed: rows.filter((r) => r.closed).length, legs: rows };
  out.push(sum);
  console.log(`\n── ${name} ${'─'.repeat(50)}`);
  for (const r of rows)
    console.log(`  ${r.name.padEnd(12)} detour ${String(r.detour).padEnd(6)} stalled ${String(r.stalled).padStart(5)}%  contact ${String(r.contacts).padStart(5)}%  ${r.closed ? 'closed ' + r.ms + 'ms' : 'NEVER CLOSED'}`);
  console.log(`  MEAN         detour ${sum.detour}  stalled ${sum.stalled}%  contact ${sum.contacts}%  closed ${sum.closed}/${rows.length}`);
}
writeFileSync('docs/evidence/arena-pilot/junction-vader-nav.json', JSON.stringify(out, null, 2));
console.log('\nwrote docs/evidence/arena-pilot/junction-vader-nav.json');
await browser.close();
