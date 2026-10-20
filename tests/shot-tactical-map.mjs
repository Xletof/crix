// EVIDENCE — PHASE 3C-B: THE DETENTION BLOCK AS EACH SYSTEM SEES IT.
// Writes `docs/evidence/tactical-engagement-audit/detention-obstacle-map.png`
// and prints the concealment probe; asserts nothing.
//
// The picture is the REAL room — backdrop, cover, props, exactly as `loadRoom`
// builds them, rendered by the game — with every representation the AI reads
// drawn over it from the live objects, never from `rooms.js`:
//   cyan fill    the physics body = the LOS rect (`scene.losRects` is built from
//                the same `walls` bodies, so these two cannot disagree)
//   yellow line  the sprite's rendered bounds (what the player SEES)
//   red cells    NavGrid cells marked unwalkable (cell CENTRE inside the body
//                inflated 23px — `NavGrid.build`)
//   magenta      the cover's bush radius (55) and the player's effective
//                concealment radius (55 - 22*0.3)
//   white ring   the closest a COLLIDING player's centre can get (body + 22)
//   green        gates, spawn, exit, terminals
//
// The camera, viewport and canvas are resized for this one page only; the
// page measures nothing else. The concealment probe walks the real player
// (keys, physics, collisions) into every cover object from 16 bearings and
// reports whether `hiddenInBush` was EVER set.
//
// usage: node tests/shot-tactical-map.mjs [--out=DIR] [--map-only]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { CHROME, bootPage } from './diag-stuck-audit.mjs';

const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const OUT = opt('out', new URL('../docs/evidence/tactical-engagement-audit/', import.meta.url).pathname);
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-setuid-sandbox'] });

// ── 1. concealment probe, in an ordinary page ──
if (!process.argv.includes('--map-only')) {
  const p = await bootPage(browser, { q: 'encdbg=1&room=detention&sector=12&wave=1', flags: 'roster=v1&gait=v2&move=v22' });
  const r = await p.evaluate(() => {
    const gs = window.__gs, P = gs.player, K = gs.keys;
    gs.arenaActive = false;
    for (const e of gs.enemies.getChildren().slice()) gs._destroyEnemyFully(e);
    window.__headless = true;
    const out = [];
    for (const b of gs.bushSystem.bushes) {
      let hiddenEver = false, minD = Infinity;
      for (let k = 0; k < 16; k++) {
        const a = k * Math.PI / 8, sx = b.x + Math.cos(a) * 130, sy = b.y + Math.sin(a) * 130;
        P.setPosition(sx, sy); P.body.reset(sx, sy);
        for (let t = 0; t < 90; t++) {
          const dx = b.x - P.x, dy = b.y - P.y;
          K.D.isDown = dx > 2; K.A.isDown = dx < -2; K.S.isDown = dy > 2; K.W.isDown = dy < -2;
          window.__adv(1);
          minD = Math.min(minD, Math.hypot(P.x - b.x, P.y - b.y));
          if (P.hiddenInBush) hiddenEver = true;
        }
      }
      out.push({ x: b.x, y: b.y, r: b.r, effective: +(b.r - 22 * 0.3).toFixed(1), closestCentrePx: +minD.toFixed(1), hiddenEver });
    }
    K.A.isDown = K.D.isDown = K.W.isDown = K.S.isDown = false;
    return out;
  });
  console.log('concealment probe — a colliding player walked into each cover object from 16 bearings:');
  for (const q of r) console.log(`  cover (${q.x},${q.y}) bush r ${q.r}, hidden below ${q.effective}px; closest the player's centre got: ${q.closestCentrePx}px; hiddenInBush ever: ${q.hiddenEver}`);
  await p.close();
}

// ── 2. the map ──
{
  const W = 1600, H = 1400;
  const p = await bootPage(browser, { q: 'encdbg=1&room=detention&sector=12&wave=1', flags: 'roster=v1&gait=v2&move=v22', viewport: { width: W, height: H } });
  const png = await p.evaluate(({ W, H }) => {
    const g = window.game, gs = window.__gs;
    gs.arenaActive = false;
    for (const e of gs.enemies.getChildren().slice()) gs._destroyEnemyFully(e);
    gs.player.setVisible(false);
    gs.cameras.main.resetFX();
    if (gs._sectorTint) gs._sectorTint.setAlpha(0);
    const hud = g.scene.getScene('HUD'); if (hud) hud.sys.setVisible(false);
    g.scale.resize(W, H);
    const cam = gs.cameras.main;
    cam.setViewport(0, 0, W, H); cam.setZoom(1); cam.setScroll(0, 0);
    gs.scene.pause();

    const G = gs.add.graphics().setDepth(1e6);
    const NG = gs.navGrid;
    // nav cells
    for (let c = 0; c < NG.cols; c++) for (let r = 0; r < NG.rows; r++) {
      const x = c * NG.gridSize, y = r * NG.gridSize;
      if (!NG.grid[c][r]) { G.fillStyle(0xff2020, 0.30); G.fillRect(x, y, NG.gridSize, NG.gridSize); }
      G.lineStyle(1, 0xffffff, 0.08); G.strokeRect(x, y, NG.gridSize, NG.gridSize);
    }
    const ws = gs.walls.getChildren().filter((o) => o.active && o.body);
    ws.forEach((w, i) => {
      const b = w.body, vb = w.getBounds();
      G.lineStyle(2, 0xffd040, 0.95); G.strokeRect(vb.x, vb.y, vb.width, vb.height);
      G.fillStyle(0x30e0ff, 0.35); G.fillRect(b.x, b.y, b.width, b.height);
      G.lineStyle(2, 0x30e0ff, 1); G.strokeRect(b.x, b.y, b.width, b.height);
      // closest a colliding player's centre can come (rounded-rect offset by 22)
      G.lineStyle(1, 0xffffff, 0.6);
      G.strokeRoundedRect?.(b.x - 22, b.y - 22, b.width + 44, b.height + 44, 22);
      gs.add.text(b.x + 3, b.y + 2, `${i}`, { fontFamily: 'monospace', fontSize: '14px', color: '#ffffff', backgroundColor: '#000000a0' }).setDepth(1e6 + 1);
      gs.add.text(vb.x, vb.bottom + 2, `${w.texture.key}  body ${b.width}x${b.height}  sprite ${Math.round(vb.width)}x${Math.round(vb.height)}`,
        { fontFamily: 'monospace', fontSize: '11px', color: '#ffe080', backgroundColor: '#000000b0' }).setDepth(1e6 + 1);
    });
    for (const b of gs.bushSystem.bushes) {
      G.lineStyle(2, 0xff40ff, 0.9); G.strokeCircle(b.x, b.y, b.r);
      G.lineStyle(1, 0xff40ff, 0.9); G.strokeCircle(b.x, b.y, b.r - 22 * 0.3);
    }
    const mark = (x, y, label, col) => { G.fillStyle(col, 0.9); G.fillRect(x - 10, y - 10, 20, 20);
      gs.add.text(x + 13, y - 8, label, { fontFamily: 'monospace', fontSize: '13px', color: '#c0ffc0', backgroundColor: '#000000b0' }).setDepth(1e6 + 1); };
    const S = gs.roomSpec;
    (S.gates || []).forEach((q, i) => mark(q.x, q.y, `gate ${i}`, 0x40ff60));
    (S.terminals || []).forEach((q, i) => mark(q.x, q.y, `terminal ${i}`, 0x40c0ff));
    mark(S.spawn.x, S.spawn.y, 'player spawn', 0xffffff);
    mark(S.exit.x, S.exit.y, 'exit', 0xffffff);
    const lines = [
      'DETENTION BLOCK as the systems see it (live objects, not rooms.js)',
      'cyan fill = physics body = LOS rect (one source)   yellow = rendered sprite bounds   red cell = NavGrid unwalkable (cell centre in body+23)',
      'magenta = cover bush radius 55 / player concealment radius 48.4   white = nearest a COLLIDING player centre can reach (body + 22)',
    ];
    lines.forEach((t, k) => gs.add.text(12, H - 66 + k * 20, t, { fontFamily: 'monospace', fontSize: '13px', color: '#ffffff', backgroundColor: '#000000c0' }).setDepth(1e6 + 2));
    window.__headless = false;
    // the renderer's own snapshot, at the canvas's internal resolution — the
    // CSS display size of a FIT canvas does not follow `scale.resize`
    return new Promise((res) => { g.renderer.snapshot((img) => res(img.src)); g.step(window.__t += 16, 16); });
  }, { W, H });
  writeFileSync(`${OUT}detention-obstacle-map.png`, Buffer.from(png.split(',')[1], 'base64'));
  console.log(`wrote ${OUT}detention-obstacle-map.png`);
  await p.close();
}
await browser.close();
