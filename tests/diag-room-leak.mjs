// DIAG — ROOM TRANSITION CLEANUP.
//
//   node tests/diag-room-leak.mjs
//
// `_clearRoomEntities` sweeps the room's display objects with
// `roomLayer.getChildren().forEach((o) => o.destroy())`. `getChildren()` hands
// back the group's LIVE internal array and `destroy()` splices the member out
// of it, so the iteration index outruns the shrinking array and every other
// element is skipped. The survivors are real, visible objects belonging to the
// PREVIOUS room: a hangar wall console standing in the detention block.
//
// What this measures, across a rotation of room loads:
//   - display-list size after each load (must reach a fixed point)
//   - room-layer texture keys that do not belong to the room now loaded
//   - EnvLight part count and additive-object count (must not accumulate)
//   - physics bodies (must not accumulate)
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

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

const R = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { ROOMS } = await import('/src/data/rooms.js');
  const order = ['hangar', 'corridor', 'detention', 'vader'];

  const quiet = async () => {
    gs._roomModifier = null;
    gs.events.emit('modifier-active', null, null);
    gs.arenaActive = false;
    gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
    await new Promise((r) => setTimeout(r, 900));
    gs.arenaActive = false;
  };

  // Which textures does a given room legitimately own? Anything in roomLayer
  // whose texture key is not derivable from the room now loaded is a survivor
  // from the room before it.
  const layerKeys = () => {
    const m = {};
    for (const o of gs.roomLayer.getChildren()) {
      const k = o.texture?.key ?? o.type;
      m[k] = (m[k] || 0) + 1;
    }
    return m;
  };

  const rows = [];
  for (let round = 0; round < 3; round++) {
    for (const id of order) {
      gs.loadRoom(ROOMS.find((r) => r.id === id));
      await quiet();
      rows.push({
        round, id,
        display: gs.children.list.length,
        layer: gs.roomLayer.getLength(),
        keys: layerKeys(),
        envParts: gs.envLight?.parts?.length ?? -1,
        additive: gs.children.list.filter((o) => o.blendMode === 1 && o.depth <= 12).length,
        bodies: gs.physics.world.bodies.size + gs.physics.world.staticBodies.size,
        walls: gs.walls.getLength(),
      });
    }
  }
  return rows;
});
await browser.close();

console.log('round room        display  layer  envParts  additive  bodies  walls');
for (const r of R) {
  console.log(`  ${r.round}   ${r.id.padEnd(10)} ${String(r.display).padStart(6)} ${String(r.layer).padStart(6)} ${String(r.envParts).padStart(9)} ${String(r.additive).padStart(9)} ${String(r.bodies).padStart(7)} ${String(r.walls).padStart(6)}`);
}
console.log('\nroom-layer texture keys, last round:');
for (const r of R.slice(-4)) console.log(`  ${r.id.padEnd(10)}`, JSON.stringify(r.keys));

// A fixed point: the same room loaded twice must produce the same counts.
const byRoom = {};
for (const r of R) (byRoom[r.id] ||= []).push(r);
let bad = 0;
for (const [id, rs] of Object.entries(byRoom)) {
  const d = rs.map((r) => r.display);
  const l = rs.map((r) => r.layer);
  if (new Set(d.slice(1)).size !== 1 || d[1] !== d[2]) { console.log(`  DRIFT ${id} display ${d.join(' -> ')}`); bad++; }
  if (new Set(l.slice(1)).size !== 1) { console.log(`  DRIFT ${id} layer ${l.join(' -> ')}`); bad++; }
}
console.log(bad ? `\nFAIL: ${bad} drifting counts` : '\nOK: room load counts reach a fixed point');
