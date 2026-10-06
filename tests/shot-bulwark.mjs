// BULWARK PRODUCTION INTEGRATION — EVIDENCE. Same rules as shot-roster-2b.mjs:
// the REAL runtime, the loop slept and stepped at exactly 1000/60, `Date.now`
// stepped with it, `Math.random` seeded, videos encoded at 30fps from every
// second tick (so they play at real 1x speed).
//
// usage: node tests/shot-bulwark.mjs <stills|videos|all|NAME...> [outdir]
//   stills  sheets, facings, sidearm, colliders, gait frames, shield idle,
//           block strip, super strip, hierarchy
//   videos  gait live, block live, rapid, super, vanguard live, legacy-vs-v1 A/B
//   NAME    any single step below (e.g. `blockstrip superlive`)

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const ARGS = process.argv.slice(2);
const OUT = new URL('../docs/evidence/roster-bulwark/', import.meta.url).pathname;
const BASE = 'http://localhost:5173/';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const FFMPEG = '/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux';
const SEED = 4242;
const STILL = 'encdbg=1&room=detention&sector=1';
const FLAGS = 'roster=v1&gait=v2&move=v22';
const VANGUARD = 'encdbg=vanguard&room=hangar&sector=8&wave=2';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const fail = (m) => { console.error(`FAIL: ${m}`); process.exit(1); };
const b64 = (buf) => `data:image/png;base64,${buf.toString('base64')}`;

async function stepBoot(frame) {
  await frame.waitForFunction(() => window.game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 45000 });
  await frame.evaluate(async (seed) => {
    const g = window.game;
    g.loop.sleep();
    let s = 12345;
    Math.random = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    window.__t = 100000;
    Date.now = () => window.__t;
    window.__adv = (n = 1) => { for (let i = 0; i < n; i++) { window.__t += 1000 / 60; g.step(window.__t, 1000 / 60); } };
    g.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed });
    window.__adv(2);
    const url = performance.getEntriesByType('resource').map((r) => r.name).find((n) => /systems\/debug\.js/.test(n));
    (await import(url)).setGodMode(true);
    window.__gs = g.scene.getScene('Game');
    for (let i = 0; i < 300 && !window.__gs.roomSpec; i++) window.__adv(1);
    window.__adv(20);
    window.__quiet = () => {
      const gs = window.__gs, hud = g.scene.getScene('HUD');
      gs.cameras.main.resetFX();
      gs._sectorTint?.setAlpha(0);
      if (hud) {
        hud.banner?.setAlpha(0);
        for (const o of hud.children.list) if (o.depth >= 47 && o.depth <= 49) o.setVisible(false);
      }
    };
    window.__freeze = (e, aim) => { e._performing = true; e._movePlanted = true; e._aim = aim; if (e._shieldFacing != null) e._shieldFacing = aim; e.setVelocity?.(0, 0); };
  }, SEED);
}

function videoWriter(file, fps = 30) {
  const ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(fps), '-i', 'pipe:0',
    '-vf', 'format=yuv420p', '-c:v', 'vp8', '-b:v', '6M', '-crf', '6', '-qmin', '2', '-qmax', '28', '-auto-alt-ref', '0', file]);
  ff.stderr.on('data', (d) => process.stderr.write(d));
  ff.stdin.on('error', (e) => fail(`ffmpeg stdin: ${e.message}`));
  let ended = false;
  ff.on('exit', (code) => { if (!ended && code) fail(`ffmpeg exited ${code}`); });
  return {
    write: (buf) => new Promise((res) => { if (ff.stdin.write(buf)) res(); else ff.stdin.once('drain', res); }),
    end: () => new Promise((res) => { ended = true; ff.on('close', res); ff.stdin.end(); }),
  };
}

async function compose(file, { title, cols, cellW, cellH, cells, legend = [], bg = '#181a1f', scale = 1 }) {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const url = await page.evaluate(async ({ title, cols, cellW, cellH, cells, legend, bg, scale }) => {
    const pad = 10, head = title ? 34 : 6, lab = 18, legH = legend.length * 18 + (legend.length ? 10 : 0);
    const rows = Math.ceil(cells.length / cols), W2 = cellW * scale, H2 = cellH * scale;
    const W = pad + cols * (W2 + pad), H = head + rows * (H2 + lab + pad) + legH + pad;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    x.fillStyle = bg; x.fillRect(0, 0, W, H);
    x.fillStyle = '#e4e7ee'; x.font = 'bold 16px monospace'; if (title) x.fillText(title, pad, 23);
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i]; if (!cell) continue;
      const cx = pad + (i % cols) * (W2 + pad), cy = head + Math.floor(i / cols) * (H2 + lab + pad);
      x.fillStyle = '#aab0bd'; x.font = '12px monospace'; x.fillText(cell.label || '', cx, cy + 13);
      if (cell.png) { const img = new Image(); img.src = cell.png; await img.decode(); x.drawImage(img, cx, cy + lab, W2, H2); }
    }
    let ly = H - legH - pad + 14;
    x.font = '12px monospace';
    for (const [col, text] of legend) { x.fillStyle = col; x.fillRect(pad, ly - 9, 10, 10); x.fillStyle = '#d0d4dc'; x.fillText(text, pad + 16, ly); ly += 18; }
    return c.toDataURL('image/png');
  }, { title, cols, cellW, cellH, cells, legend, bg, scale });
  writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
  await page.close();
  console.log('wrote', file);
}

async function quietRoom(page) {
  await page.evaluate(() => {
    const gs = window.__gs;
    gs.arenaActive = false; gs._roomModifier = null; gs.events.emit('set-darkness', false);
    for (const e of gs.enemies.getChildren().slice()) gs._destroyEnemyFully(e);
    for (const o of gs.roomLayer.getChildren()) {
      if ((o.displayWidth || 0) >= 1000) continue;
      o.setVisible(false); if (o.body) o.body.enable = false;
    }
    for (const t of gs.terminals || []) { for (const k of Object.values(t)) { if (k?.setVisible) k.setVisible(false); if (k?.body) k.body.enable = false; } t.setVisible?.(false); }
    for (const w of gs.weaponPickups || []) { w.setVisible?.(false); for (const k of Object.values(w)) if (k?.setVisible) k.setVisible(false); }
    for (const o of gs.children.list) if (o.type === 'Text') o.setVisible(false);
    for (const q of gs.envLight?.parts || []) (q.img || q.image || q)?.setVisible?.(false);
    for (const w of gs.walls?.getChildren?.() || []) if (w.body) w.body.enable = false;
    gs.cameraDirector.update = () => {};
    window.__adv(1);
  });
}
async function stillPage(extra = '', flags = FLAGS) {
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  page.on('pageerror', (e) => fail(`still: ${e.message}`));
  await page.goto(BASE + `?nodlg=1&nofreeze=1&${flags}${extra}&${STILL}`);
  await stepBoot(page);
  await quietRoom(page);
  return page;
}
const lab = `window.__lab = (x, y, t, o = 0.5) => window.__gs.add.text(x, y, t, { fontFamily: 'monospace', fontSize: '12px', color: '#e4e7ee', backgroundColor: '#000a' }).setOrigin(o, 0.5).setDepth(9999);`;

// ── 1-2. SHEETS ──────────────────────────────────────────────────────────
async function sheets() {
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  await page.goto(BASE + `?nodlg=1&${FLAGS}`);
  await page.waitForFunction(() => window.game?.textures?.exists('ro-blw-E'), null, { timeout: 45000 });
  for (const [key, file, name] of [['ro-blw-R', 'bulwark-v1-sheet-regular.png', 'BULWARK REGULAR'], ['ro-blw-E', 'bulwark-v1-sheet-elite.png', 'BULWARK ELITE']]) {
    const url = await page.evaluate(({ key, name }) => {
      const src = window.game.textures.get(key).getSourceImage();
      const fw = 96, fh = 104, gap = 10, labH = 16, left = 84, top = 40;
      const rows = [
        ['FRONT', 0, ['0 idle', '1 walk', '2 walk', '3 walk', '4 walk', '5 walk', '6 walk', '7 fire']],
        ['BACK', 8, ['8 idle', '9 walk', '10 walk', '11 walk', '12 walk', '13 walk', '14 walk', '15 fire']],
        ['SIDE (E)', 16, ['16 idle', '17 walk', '18 walk', '19 walk', '20 walk', '21 walk', '22 walk', '23 fire']],
        ['POSES', 24, ['24 F raise', '25 F thrust', '26 F recoil', '27 B raise', '28 B thrust', '29 B recoil', '30 S raise', '31 S thrust', '32 S recoil']],
        ['STRAFE F', 33, ['33', '34', '35', '36', '37', '38']],
        ['STRAFE B', 39, ['39', '40', '41', '42', '43', '44']],
        ['STRAFE S', 45, ['45', '46', '47', '48', '49', '50']],
      ];
      const W = left + 9 * (fw + gap) + gap, H = top + rows.length * (fh + labH + gap) + 30;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
      x.fillStyle = '#212328'; x.fillRect(0, 0, W, H);
      x.fillStyle = '#e4e7ee'; x.font = 'bold 14px monospace'; x.fillText(`${name} — ${key} — 51 frames (?gait=v2: 33 stock + 18 strafe), 24x26 logical @4 (96x104), 1x`, 10, 24);
      rows.forEach(([rn, base, labels], ri) => {
        const y0 = top + ri * (fh + labH + gap);
        x.fillStyle = '#c8ccd6'; x.font = 'bold 12px monospace'; x.fillText(rn, 8, y0 + labH + fh / 2);
        labels.forEach((l, i) => {
          const x0 = left + i * (fw + gap);
          x.fillStyle = '#8a8f9c'; x.font = '11px monospace'; x.fillText(l, x0, y0 + 12);
          x.drawImage(src, (base + i) * fw, 0, fw, fh, x0, y0 + labH, fw, fh);
        });
      });
      x.fillStyle = '#8a8f9c'; x.font = '11px monospace';
      x.fillText('deck #212328 behind every frame. West = SIDE mirrored by flipX. The sidearm is a separate overlay; the FIELD is a runtime surface (not in the sheet).', 10, H - 10);
      return c.toDataURL('image/png');
    }, { key, name });
    writeFileSync(OUT + file, Buffer.from(url.split(',')[1], 'base64'));
    console.log('wrote', OUT + file);
  }
  await page.close();
}

// ── 3. FACINGS ───────────────────────────────────────────────────────────
async function facings() {
  const page = await stillPage();
  await page.evaluate(lab);
  const y = await page.evaluate(() => {
    const gs = window.__gs, cam = gs.cameras.main;
    const X0 = 600, Y0 = 560, DX = 150, DY = 175;
    const P = gs.player; P.setPosition(X0 + 300, Y0 + 900); P.body.reset(P.x, P.y); P.setVisible(false); P.weaponSprite?.setVisible(false);
    cam.setScroll(X0 - 170, Y0 - 150);
    const dirs = [['FRONT (S)', Math.PI / 2], ['BACK (N)', -Math.PI / 2], ['SIDE (E)', 0], ['WEST (flip)', Math.PI]];
    const rows = [['REGULAR v1', {}], ['ELITE v1', { elite: true }], ['LEGACY', { legacyArt: true }], ['SHOCK CAPTAIN', null]];
    dirs.forEach(([name, aim], c) => {
      window.__lab(X0 + c * DX, Y0 - 95, name);
      rows.forEach(([r, spec], ri) => {
        const x = X0 + c * DX, yy = Y0 + ri * DY;
        let e;
        if (!spec) { e = gs.spawnChampion(x, yy, 'captain'); window.__freeze(e, aim); const { dir } = e._facingSuffix(); e.play(`${e._animPrefix}-idle-${dir}`); }
        else { e = gs.spawnEnemyAt('shielded', x, yy, spec); window.__freeze(e, aim); if (!e._curtain) e._drawShield(16); }
        e.body.reset(x, yy);
        if (c === 0) window.__lab(x - 74, yy, r, 1);
      });
    });
    window.__adv(3);
    for (const e of gs.enemies.getChildren()) if (e.enemyType === 'shielded' && !e._curtain) e._drawShield(16);
    window.__quiet(); window.__adv(1);
    for (const e of gs.enemies.getChildren()) if (e.enemyType === 'shielded' && !e._curtain) e._drawShield(16);
    window.game.step(window.__t, 0);
    return cam.y;
  });
  const buf = await page.screenshot({ clip: { x: 0, y, width: 720, height: 780 } });
  await compose(OUT + 'bulwark-v1-facings.png', {
    title: 'BULWARK v1 — Regular / Elite / legacy / unchanged Shock Captain — live runtime, 1x',
    cols: 1, cellW: 720, cellH: 780,
    cells: [{ label: 'columns: aim S / N / E / W. Field drawn on the frozen arc (facing ± 1.35 rad); legacy row shows its stroked arc.', png: b64(buf) }],
  });
  await page.close();
}

// ── 4. SIDEARM: pivot, gameplay spawn, the real bolt on its first drawn frame ─
async function sidearm() {
  const page = await stillPage();
  const AIMS = [['E', 0], ['SE', Math.PI / 4], ['S', Math.PI / 2], ['W', Math.PI], ['N', -Math.PI / 2]];
  const TIERS = [['REGULAR', {}], ['ELITE', { elite: true }], ['LEGACY', { legacyArt: true }]];
  const cells = [], nums = [];
  for (const [tname, spec] of TIERS) for (const [aname, aim] of AIMS) {
    const r = await page.evaluate(({ spec, aim }) => {
      const gs = window.__gs, cam = gs.cameras.main;
      for (const e of gs.enemies.getChildren().slice()) gs._destroyEnemyFully(e);
      gs.enemyBullets.getChildren().forEach((b) => b.disableBody?.(true, true));
      window.__ann?.destroy();
      const X = 700, Y = 650;
      const P = gs.player; P.setPosition(X + Math.cos(aim) * 420, Y + Math.sin(aim) * 420); P.body.reset(P.x, P.y); P.setVisible(false); P.weaponSprite?.setVisible(false);
      const e = gs.spawnEnemyAt('shielded', X, Y, spec);
      window.__freeze(e, aim); e.body.reset(X, Y);
      cam.setZoom(2); cam.centerOn(X + Math.cos(aim) * 30, Y + Math.sin(aim) * 30);
      window.__adv(2);
      const ws = e.weaponSprite, m = new window.Phaser.Math.Vector2();
      ws.getWorldTransformMatrix().transformPoint((1 - ws.originX) * ws.width, 0, m);
      gs.fireShooter(e, aim);
      const b = gs.enemyBullets.getChildren().find((q) => q.active);
      const S = { x: b.x, y: b.y };
      const g = window.__ann = gs.add.graphics().setDepth(9990);
      const c = Math.cos(aim), s = Math.sin(aim), n = { x: -s, y: c };
      g.lineStyle(1, 0xffffff, 0.35); g.lineBetween(X - c * 30, Y - s * 30, X + c * 140, Y + s * 140);
      g.lineStyle(2, 0x40e0ff, 1); g.lineBetween(ws.x - 5, ws.y, ws.x + 5, ws.y); g.lineBetween(ws.x, ws.y - 5, ws.x, ws.y + 5);
      g.fillStyle(0xff40d0, 1); g.fillCircle(S.x, S.y, 2.5);
      g.lineStyle(2, 0xffe040, 1); g.lineBetween(m.x + n.x * 9, m.y + n.y * 9, m.x - n.x * 9, m.y - n.y * 9);
      window.__adv(1);
      const F = { x: b.x, y: b.y }, hb = b.displayWidth / 2, off = 9;
      g.lineStyle(2, 0x10ee10, 0.9);
      g.lineBetween(F.x - c * hb + n.x * off, F.y - s * hb + n.y * off, F.x + c * hb + n.x * off, F.y + s * hb + n.y * off);
      g.lineBetween(F.x + c * hb + n.x * (off - 4), F.y + s * hb + n.y * (off - 4), F.x + c * hb + n.x * (off + 4), F.y + s * hb + n.y * (off + 4));
      window.__quiet();
      window.game.step(window.__t, 0);
      const along = (q) => (q.x - X) * c + (q.y - Y) * s;
      const cx = X + Math.cos(aim) * 30, cy = Y + Math.sin(aim) * 30;
      return { scr: { x: (cx - cam.worldView.x) * cam.zoom + cam.x, y: (cy - cam.worldView.y) * cam.zoom + cam.y },
        pivot: along(ws), spawn: along(S), firstHead: along(b) + hb, muzzle: along(m), radius: e.cfg.radius, len: ws.width };
    }, { spec, aim });
    const W = 300;
    const buf = await page.screenshot({ clip: { x: Math.round(r.scr.x - W / 2), y: Math.round(r.scr.y - W / 2), width: W, height: W } });
    cells.push({ label: `${tname} ${aname}`, png: b64(buf) });
    nums.push({ tier: tname, aim: aname, radius: r.radius, pivot: +r.pivot.toFixed(1), spawn: +r.spawn.toFixed(1), firstDrawnHead: +r.firstHead.toFixed(1), muzzle: +r.muzzle.toFixed(1), overlayPx: r.len });
  }
  await page.evaluate(() => { window.__gs.cameras.main.setZoom(1); });
  // the overlay textures themselves, 1x and 4x
  const tex = await page.evaluate(() => {
    const out = {};
    for (const k of ['ro-w-blw-R', 'ro-w-blw-E', 'ro-w-rif-R', 'ro-w-gun-R']) {
      const src = window.game.textures.get(k).getSourceImage(), Z = 4;
      const c = document.createElement('canvas'); c.width = src.width * Z + 8; c.height = src.height * Z + 8;
      const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.fillStyle = '#212328'; x.fillRect(0, 0, c.width, c.height);
      x.drawImage(src, 4, 4, src.width * Z, src.height * Z);
      out[k] = { png: c.toDataURL('image/png'), w: src.width };
    }
    return out;
  });
  await compose(OUT + 'bulwark-v1-sidearm.png', {
    title: 'BULWARK v1 SIDEARM — real overlay + a real bolt on its first rendered frame (2x camera zoom)',
    cols: 5, cellW: 300, cellH: 300,
    cells: [...cells,
      { label: `ro-w-blw-R (4x) — ${tex['ro-w-blw-R'].w}px`, png: tex['ro-w-blw-R'].png }, { label: `ro-w-blw-E (4x) — ${tex['ro-w-blw-E'].w}px`, png: tex['ro-w-blw-E'].png },
      { label: `carbine ro-w-rif-R (4x) — ${tex['ro-w-rif-R'].w}px`, png: tex['ro-w-rif-R'].png }, { label: `Gunner ro-w-gun-R (4x) — ${tex['ro-w-gun-R'].w}px`, png: tex['ro-w-gun-R'].png }],
    legend: [
      ['#40e0ff', 'weapon pivot — cfg.radius - 4 along the aim (Enemy.preUpdate, frozen)'],
      ['#ff40d0', 'GAMEPLAY SPAWN — cfg.radius + 4 (fireShooter, frozen, NOT moved)'],
      ['#ffe040', 'DRAWN MUZZLE — the outer edge of the sidearm on the bolt axis'],
      ['#10ee10', 'the real bolt on its first rendered frame, under gun and body; tick = its leading edge'],
      ['#aab0bd', 'muzzle = pivot + 54 (bolt 700px/s). A 28px pistol in a gloved hand on an armoured forearm; the Elite forearm is 8px longer at the back (pivot 9px further out).'],
    ],
  });
  writeFileSync(OUT + 'bulwark-v1-sidearm-numbers.json', JSON.stringify(nums, null, 1));
  console.table(nums);
  await page.close();
}

// ── 5. COLLIDERS ─────────────────────────────────────────────────────────
async function colliders() {
  const page = await stillPage('&colliders=1');
  await page.evaluate(lab);
  const r = await page.evaluate(() => {
    const gs = window.__gs, cam = gs.cameras.main;
    const X0 = 520, Y0 = 600, DX = 150, DY = 160;
    const P = gs.player; P.setPosition(X0, Y0 + 700); P.body.reset(P.x, P.y); P.setVisible(false); P.weaponSprite?.setVisible(false);
    const who = [['LEGACY R', { legacyArt: true }, false], ['v1 R', {}, false], ['LEGACY E', { legacyArt: true }, true], ['v1 E', { elite: true }, false]];
    const out = [];
    who.forEach(([name, spec, legacyElite], i) => {
      for (const [row, aim] of [[0, Math.PI / 2], [1, 0]]) {
        const x = X0 + i * DX, y = Y0 + row * DY;
        const e = gs.spawnEnemyAt('shielded', x, y, spec);
        if (legacyElite) gs._makeElite(e, { legacyLook: true });
        window.__freeze(e, aim); e.body.reset(x, y);
        if (!e._curtain) e._drawShield(16);
        if (row === 0) window.__lab(x, y - 75, name);
        if (row === 0) out.push({ name, bodyW: +e.body.width.toFixed(2), radius: e.cfg.radius, scale: e.scaleX, tex: e.texture.key });
      }
    });
    cam.centerOn(X0 + 1.5 * DX, Y0 + DY / 2);
    window.__adv(3);
    for (const e of gs.enemies.getChildren()) if (!e._curtain) e._drawShield(16);
    window.__quiet(); window.__adv(1);
    for (const e of gs.enemies.getChildren()) if (!e._curtain) e._drawShield(16);
    window.game.step(window.__t, 0);
    const top = (Y0 - 100 - cam.worldView.y) + cam.y, bot = (Y0 + DY + 80 - cam.worldView.y) + cam.y;
    return { out, top, h: bot - top };
  });
  console.table(r.out);
  const buf = await page.screenshot({ clip: { x: 0, y: Math.round(r.top), width: 720, height: Math.round(r.h) } });
  await compose(OUT + 'bulwark-v1-colliders.png', {
    title: 'BULWARK COLLIDERS — ?colliders=1, gameplay scale (1x). Top row aim S, bottom aim E',
    cols: 1, cellW: 720, cellH: Math.round(r.h),
    cells: [{ label: `v1 Elite renders at 1.0 and keeps the HISTORICAL ${r.out[3].bodyW}px body (legacy r33 x 1.4). Field radius 46 on both tiers.`, png: b64(buf) }],
    legend: [
      ['#40ff80', `physics body: regular ${r.out[1].bodyW}px wide; elite ${r.out[3].bodyW}px in both legacy and v1 (unchanged)`],
      ['#ffe040', 'cfg.radius: what a bolt must touch (block decided here) — regular 24, elite 33, identical in legacy and v1'],
    ],
  });
  await page.close();
}

// ── 6. GAIT FRAMES ───────────────────────────────────────────────────────
async function gaitFrames() {
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  await page.goto(BASE + `?nodlg=1&${FLAGS}`);
  await page.waitForFunction(() => window.game?.textures?.exists('ro-blw-E'), null, { timeout: 45000 });
  const url = await page.evaluate(() => {
    const Z = 3, fw = 96, fh = 104;
    const rows = [
      ['ro-blw-R', 'FRONT walk (1-6) + idle', [1, 2, 3, 4, 5, 6, 0]], ['ro-blw-R', 'BACK walk + idle', [9, 10, 11, 12, 13, 14, 8]],
      ['ro-blw-R', 'SIDE walk + idle', [17, 18, 19, 20, 21, 22, 16]], ['ro-blw-R', 'STRAFE F (33-38)', [33, 34, 35, 36, 37, 38]],
      ['ro-blw-R', 'STRAFE S (45-50)', [45, 46, 47, 48, 49, 50]], ['ro-blw-E', 'ELITE SIDE walk + idle', [17, 18, 19, 20, 21, 22, 16]],
    ];
    const W = 7 * (fw * Z + 8) + 20, H = rows.length * (fh * Z + 26) + 60;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.fillStyle = '#212328'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#e4e7ee'; x.font = 'bold 18px monospace';
    x.fillText('BULWARK GAIT v2 — the heavy tactical shuffle (3x). One pelvis, knees, both boots one way, low swing, wide base.', 10, 26);
    rows.forEach(([key, name, frames], ri) => {
      const src = window.game.textures.get(key).getSourceImage();
      const y0 = 44 + ri * (fh * Z + 26);
      x.fillStyle = '#c8ccd6'; x.font = 'bold 13px monospace'; x.fillText(`${name}`, 10, y0 + 14);
      frames.forEach((f, i) => {
        const x0 = 10 + i * (fw * Z + 8);
        x.drawImage(src, f * fw, 0, fw, fh, x0, y0 + 20, fw * Z, fh * Z);
        x.fillStyle = '#8a8f9c'; x.font = '11px monospace'; x.fillText(String(f), x0 + 4, y0 + 34);
      });
    });
    return c.toDataURL('image/png');
  });
  writeFileSync(OUT + 'bulwark-gait-v2-frames.png', Buffer.from(url.split(',')[1], 'base64'));
  console.log('wrote', OUT + 'bulwark-gait-v2-frames.png');
  await page.close();
}

// ── 8. SHIELD IDLE ───────────────────────────────────────────────────────
async function shieldIdle() {
  const page = await stillPage();
  await page.evaluate(lab);
  const y = await page.evaluate(() => {
    const gs = window.__gs, cam = gs.cameras.main;
    const X0 = 560, Y0 = 560, DX = 170, DY = 200;
    const P = gs.player; P.setPosition(X0 + 170, Y0 + 640); P.body.reset(P.x, P.y);
    cam.setScroll(X0 - 190, Y0 - 150);
    const cells = [['REGULAR front', {}, Math.PI / 2], ['REGULAR back', {}, -Math.PI / 2], ['REGULAR side', {}, 0],
      ['ELITE front', { elite: true }, Math.PI / 2], ['ELITE back', { elite: true }, -Math.PI / 2], ['ELITE side', { elite: true }, 0]];
    cells.forEach(([n, spec, aim], i) => {
      const x = X0 + (i % 3) * DX, yy = Y0 + Math.floor(i / 3) * DY;
      const e = gs.spawnEnemyAt('shielded', x, yy, spec); window.__freeze(e, aim); e.body.reset(x, yy);
      window.__lab(x, yy - 80, n);
    });
    // a VANGUARD pair at its close hold (140px), both facing the player
    const pts = [[X0 + 110, Y0 + 2 * DY + 20], [X0 + 230, Y0 + 2 * DY + 20]];
    pts.forEach(([x, yy], i) => {
      const e = gs.spawnEnemyAt('shielded', x, yy, i ? { elite: true } : {});
      window.__freeze(e, Math.atan2(P.y - yy, P.x - x)); e.body.reset(x, yy);
    });
    window.__lab(X0 + 170, Y0 + 2 * DY - 70, 'VANGUARD pair at the close hold (Regular + Elite), the player below');
    window.__adv(3); window.__quiet(); window.__adv(1);
    return cam.y;
  });
  const buf = await page.screenshot({ clip: { x: 0, y, width: 720, height: 760 } });
  const x2 = await page.screenshot({ clip: { x: 120, y: y + 80, width: 500, height: 380 } });
  await compose(OUT + 'bulwark-shield-idle.png', {
    title: 'BULWARK FIELD — idle, live runtime, 1x',
    cols: 1, cellW: 720, cellH: 760,
    cells: [{ label: '1x: front / back / side x Regular / Elite, then a VANGUARD pair', png: b64(buf) }],
    legend: [['#ffffff', 'bright outer rim = the face the fire arrives at; tips at facing ± 1.35 rad = the coverage'], ['#9fb7d6', 'far half (behind him) under the body at the SAME strength — only his body hides it']],
  });
  await compose(OUT + 'bulwark-shield-idle-2x.png', { title: 'BULWARK FIELD — idle, top two rows at 2x (nearest)', cols: 1, cellW: 500, cellH: 380, scale: 2, cells: [{ label: '', png: b64(x2) }] });
  await page.close();
}

// ── 9. BLOCK STRIP (a real bolt into a real field) ──────────────────────
async function stage(page, spec = {}, X = 820, Y = 560) {
  await page.evaluate(({ spec, X, Y }) => {
    const gs = window.__gs, cam = gs.cameras.main;
    const P = gs.player; P.setPosition(X, Y + 540); P.body.reset(P.x, P.y); P.setVisible(false); P.weaponSprite?.setVisible(false);
    const e = gs.spawnEnemyAt('shielded', X, Y, spec);
    window.__freeze(e, Math.PI / 2); e.body.reset(X, Y);
    window.__blw = e;
    cam.setScroll(X - 360, Y - 380);
    window.__adv(2); window.__quiet();
  }, { spec, X, Y });
}
async function strip(page, file, title, setup, picks, legend, extraRow = null) {
  await page.evaluate(setup);
  const shots = [];
  for (let i = 0, k = 0; k < picks.length && i < 200; i++) {
    const info = await page.evaluate(() => { window.__adv(1); window.__quiet(); const f = window.__blw._curtain; return { ev: f.snapshot(), alive: window.__blw.alive }; });
    const p = picks[k];
    if (p.when(i, info)) {
      shots.push({ label: `${p.name} — ${info.ev.map((v) => `${v.kind} ${Math.round(v.t)}ms`).join(', ') || 'idle'}`, png: b64(await page.screenshot({ clip: { x: 230, y: 330, width: 260, height: 240 } })) });
      k++;
    }
  }
  const cells = shots;
  if (extraRow) cells.push(...extraRow);
  await compose(OUT + file, { title, cols: Math.min(5, picks.length), cellW: 260, cellH: 240, cells, legend, scale: 2 });
}
async function blockStrip() {
  const page = await stillPage();
  await stage(page);
  const age = (lo) => (i, info) => info.ev.some((v) => v.kind === 'block' && v.t >= lo);
  await strip(page, 'bulwark-shield-block-strip.png', 'BULWARK FIELD — NORMAL BLOCK, a real player bolt into the real field (2x, nearest). Times are the reaction\'s own age.',
    () => { window.__gs.playerBullets.fire(820, 700, -Math.PI / 2, 1100, 10, 900, { owner: 'player' }); },
    [{ name: 'incoming', when: (i) => i === 1 }, { name: 'compression', when: age(0) }, { name: 'saturated red smear', when: age(30) },
      { name: 'red propagates', when: age(80) }, { name: 'red spreading', when: age(130) }, { name: 'coral', when: age(170) },
      { name: 'pale pink', when: age(250) }, { name: 'white', when: age(330) }, { name: 'white haze relaxing', when: age(450) },
      { name: 'recovered (idle)', when: (i, info) => i > 20 && !info.ev.length }],
    [['#ff2828', 'RED = projectile energy still inside the field'], ['#ffc4cc', 'coral -> pale pink: being absorbed'], ['#ffffff', 'WHITE = absorbed; white is the END of the reaction']]);
  await page.close();
}

// ── 12. SUPER STRIP: the real Super (generic FX and all), then the field's own beats ─
async function superStrip() {
  const page = await stillPage('', `${FLAGS}`);
  // row 1: the REAL Super into an Elite Bulwark from 300px — three pellets
  // connect at that range, which an Elite survives at this sector
  await page.evaluate(() => { const gs = window.__gs; gs.enemyHpMult = 2.12; });   // sector-14 hp ramp (the real formula 1 + 14 x 0.08)
  await stage(page, { elite: true }, 820, 560);
  const tAge = (lo) => (i, info) => info.ev.some((v) => v.kind === 'tear' && v.t >= lo);
  const picks = [{ name: 'approach', when: (i) => i === 6 }, { name: 'tear (contact bloom)', when: tAge(0) }, { name: 'splits / peels', when: tAge(60) },
    { name: 'through', when: tAge(120) }, { name: 'open', when: tAge(300) }, { name: 'pull + filaments', when: tAge(450) },
    { name: 'zipper', when: tAge(560) }, { name: 'snap', when: tAge(610) }, { name: 'ripple', when: tAge(720) }, { name: 'settled', when: (i, info) => i > 30 && !info.ev.length }];
  await page.evaluate(() => { const gs = window.__gs, P = gs.player; P.setVisible(true); P.setPosition(820, 860); P.body.reset(820, 860); P.superCharge = 999; P.tryFireSuper(-Math.PI / 2); });
  const real = [];
  for (let i = 0, k = 0; k < picks.length && i < 200; i++) {
    const info = await page.evaluate(() => { window.__adv(1); window.__quiet(); const e = window.__blw; return { ev: e._curtain.snapshot(), alive: e.alive }; });
    if (!info.alive) { console.log('super strip: the bearer died'); break; }
    if (picks[k].when(i, info)) { real.push({ label: `REAL: ${picks[k].name} — ${info.ev.map((v) => `${v.kind} ${Math.round(v.t)}`).join(', ')}`, png: b64(await page.screenshot({ clip: { x: 230, y: 330, width: 260, height: 240 } })) }); k++; }
  }
  // row 2: the same beats through the real pierce seam on a calm field, so the
  // field's own response can be read without the frozen generic hit language
  await page.evaluate(() => { for (const e of window.__gs.enemies.getChildren().slice()) window.__gs._destroyEnemyFully(e); });
  await stage(page, { elite: true }, 820, 560);
  const calm = [{ label: 'FIELD ONLY: idle, before contact', png: b64(await page.screenshot({ clip: { x: 230, y: 330, width: 260, height: 240 } })) }];
  await page.evaluate(() => { window.__blw._curtain.pierce({ off: 0.18 }); });
  for (let i = 0, k = 1; k < picks.length && i < 200; i++) {
    const info = await page.evaluate(() => { window.__adv(1); window.__quiet(); return { ev: window.__blw._curtain.snapshot() }; });
    if (picks[k].when(i + 40, info)) { calm.push({ label: `FIELD ONLY: ${picks[k].name} — ${info.ev.map((v) => `${v.kind} ${Math.round(v.t)}`).join(', ') || 'idle'}`, png: b64(await page.screenshot({ clip: { x: 230, y: 330, width: 260, height: 240 } })) }); k++; }
  }
  await compose(OUT + 'bulwark-shield-super-strip.png', {
    title: 'BULWARK FIELD — SUPER: PUNCTURE -> OPEN -> HEAL (2x, nearest). Row 1: a REAL Super into an Elite (sector-14 hp). Row 2: the field alone, via the real pierce seam.',
    cols: 5, cellW: 260, cellH: 240, scale: 2, cells: [...real, ...Array(Math.max(0, 10 - real.length)).fill(null), ...calm],
    legend: [['#ffffff', 'row 1 carries the frozen generic hit language too (white body flash, pellet rings, CRIT numbers) — that is what play looks like'],
      ['#dff0ff', 'row 2: one pellet, no generic FX: bloom, split + peel, open gap, filaments re-knit, the zipper, the snap, the ripple']],
  });
  await page.close();
}

// ── HIERARCHY ────────────────────────────────────────────────────────────
async function hierarchy() {
  const page = await stillPage();
  await page.evaluate(lab);
  const y = await page.evaluate(() => {
    const gs = window.__gs, cam = gs.cameras.main;
    const X0 = 344, Y0 = 600, DX = 78;
    const P = gs.player; P.setPosition(X0 + 300, Y0 + 900); P.body.reset(P.x, P.y); P.setVisible(false); P.weaponSprite?.setVisible(false);
    cam.setScroll(X0 - 44, Y0 - 230);
    const who = [['RIF R', 'grunt', {}], ['RIF E', 'grunt', { elite: true }], ['GUN R', 'shooter', {}], ['GUN E', 'shooter', { elite: true }],
      ['BLW R', 'shielded', {}], ['BLW E', 'shielded', { elite: true }], ['MRK R', 'sniper', {}], ['MRK E', 'sniper', { elite: true }]];
    who.forEach(([name, type, spec], i) => {
      const xx = X0 + i * DX, yy = Y0;
      const e = gs.spawnEnemyAt(type, xx, yy, spec); window.__freeze(e, Math.PI / 2 + 0.35); e.body.reset(xx, yy);
      window.__lab(xx, yy - 72, name);
      const f = gs.spawnEnemyAt(type, xx, yy + 170, spec); window.__freeze(f, 0); f.body.reset(xx, yy + 170);
    });
    const c = gs.spawnChampion(X0 + 8 * DX + 6, Y0 + 80, 'captain');
    window.__freeze(c, Math.PI / 2); const { dir } = c._facingSuffix(); c.play(`${c._animPrefix}-idle-${dir}`); c.body.reset(c.x, c.y);
    window.__lab(c.x, c.y - 92, 'CAPTAIN');
    window.__adv(3); window.__quiet(); window.__adv(1);
    return cam.y + 110;
  });
  const buf = await page.screenshot({ clip: { x: 0, y, width: 720, height: 400 } });
  await compose(OUT + 'roster-v1-hierarchy-4roles.png', {
    title: 'ROSTER v1 HIERARCHY — 1x, live runtime: Rifleman / Gunner / Bulwark / Marksman (Regular, Elite) and the unchanged Shock Captain',
    cols: 1, cellW: 720, cellH: 400,
    cells: [{ label: 'top row aimed toward the camera (+20deg), bottom row aimed east. Deck: Detention escort floor. Production art only.', png: b64(buf) }],
  });
  await page.close();
}

// ── VIDEOS ───────────────────────────────────────────────────────────────
// a staged duel on the open floor: one live Bulwark (AI on, nothing frozen),
// the player 260px south firing at its front at the real cadence
async function duelVideo(file, { FR = 360, elite = false, script, extra = '' } = {}) {
  const page = await stillPage(extra);
  await page.evaluate(({ elite, script }) => {
    const gs = window.__gs;
    gs.arenaActive = false;
    const P = gs.player; P.setPosition(820, 820); P.body.reset(820, 820);
    const e = gs.spawnEnemyAt('shielded', 820, 560, elite ? { elite: true } : {});
    window.__blw = e;
    gs.cameraDirector.update = () => {};
    gs.cameras.main.setScroll(820 - 360, 690 - 640);
    window.__tick = 0;
    window.__drive = new Function('i', 'gs', 'P', 'e', script);
    window.__frame = (n) => { for (let j = 0; j < n; j++) { window.__drive(window.__tick++, gs, P, window.__blw); window.__adv(1); } window.__quiet(); };
  }, { elite, script });
  const vw = videoWriter(OUT + file);
  for (let f = 0; f < FR; f++) {
    await page.evaluate(() => window.__frame(2));
    await vw.write(await page.screenshot({ type: 'jpeg', quality: 90, clip: { x: 0, y: 84, width: 720, height: 960 } }));
  }
  await vw.end();
  const st = await page.evaluate(() => ({ alive: window.__blw.alive, stats: window.__blw._curtain?.stats }));
  console.log('wrote', OUT + file, JSON.stringify(st));
  await page.close();
}
const FIRE_AT = 'const a = Math.atan2(e.y - P.y, e.x - P.x);';
async function blockLive() {
  await duelVideo('bulwark-shield-block-live.webm', { FR: 360,
    script: `${FIRE_AT} if (i > 30 && i % 28 === 0 && e.alive) P.tryFire(a + ((i / 28) % 3 - 1) * 0.05);` });
}
async function rapidLive() {
  await duelVideo('bulwark-shield-rapid.webm', { FR: 330,
    script: `${FIRE_AT} const k = gs.keys; k.A.isDown = (i % 240) > 60 && (i % 240) < 120; k.D.isDown = (i % 240) > 180;
      if (i > 30 && i % 8 === 0 && e.alive) P.tryFire(a + ((i / 8) % 5 - 2) * 0.04);` });
}
async function superLive() {
  await duelVideo('bulwark-shield-super.webm', { FR: 420, elite: true, extra: '',
    // an Elite at the REAL sector-14 hp ramp (1 + 14 x 0.08 = 2.12): three
    // pellets connect from 260px and it survives one Super; a fresh one stands
    // in before each of the three Supers, so every tear is on a whole field
    script: `if (i === 0) gs.enemyHpMult = 2.12;
      if (i === 2 || i === 270 || i === 540) { const n = gs.spawnEnemyAt('shielded', 820, 560, { elite: true }); if (e.active) gs._destroyEnemyFully(e); window.__blw = n; return; }
      ${FIRE_AT} if (e.alive && i > 40 && (i % 270) > 40 && (i % 270) < 110 && i % 14 === 0) P.tryFire(a);
      if (e.alive && (i % 270) === 140) { P.superCharge = 999; P.tryFireSuper(a); }` });
}
const VANGUARD_SCRIPT = `
  window.__drive = (i) => {
    const gs = window.__gs, k = gs.keys, P = gs.player; if (!k) return;
    const seg = [[0,420,''],[420,560,''],[560,640,'D'],[640,760,''],[760,840,'A'],[840,1000,''],[1000,1080,'S'],[1080,1200,''],[1200,1290,'W'],[1290,99999,'']];
    const cur = seg.find(([a,b]) => i >= a && i < b)[2];
    k.A.isDown = cur === 'A'; k.D.isDown = cur === 'D'; k.W.isDown = cur === 'W'; k.S.isDown = cur === 'S';
    if (i >= 380 && i % 9 === 0) P.keyboardFire();
    if (i === 900 || i === 1240) { P.superCharge = 999; P.tryFireSuper(P._autoAimAngle()); }
  };
  window.__tick = 0;
  window.__frame = (n) => { for (let j = 0; j < n; j++) { window.__drive(window.__tick++); window.__adv(1); } window.__quiet(); };
`;
async function encounterVideo(q, file, FR) {
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  page.on('pageerror', (e) => fail(`live: ${e.message}`));
  await page.goto(BASE + `?nodlg=1&nofreeze=1&${q}`);
  await stepBoot(page);
  await page.evaluate(VANGUARD_SCRIPT);
  const vw = videoWriter(OUT + file);
  for (let f = 0; f < FR; f++) {
    await page.evaluate(() => window.__frame(2));
    await vw.write(await page.screenshot({ type: 'jpeg', quality: 90 }));
    if (f % 150 === 0) console.log(file, f, await page.evaluate(() => { const v = window.__gs._vanguardFront; return `${window.__gs.enemies.getChildren().filter((e) => e.active).map((e) => e.texture.key).join(',')} front=${v ? (v.released ? v.why : 'holding') : '-'}`; }));
  }
  await vw.end();
  console.log('wrote', OUT + file);
  await page.close();
}
async function ab(q, file, FR) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1280 } });
  const base = `?nodlg=1&nofreeze=1&${q}`, qL = '', qR = '&roster=v1&gait=v2';
  await page.setContent(`<body style="margin:0;background:#000;display:flex;position:relative">
    <iframe src="${BASE}${base}${qL}" width="720" height="1280" style="border:0"></iframe>
    <iframe src="${BASE}${base}${qR}" width="720" height="1280" style="border:0"></iframe>
    <div style="position:absolute;left:0;top:1236px;width:720px;text-align:center;font:bold 22px monospace;color:#fff;background:#000a;padding:6px 0">LEGACY (default)</div>
    <div style="position:absolute;left:720px;top:1236px;width:720px;text-align:center;font:bold 22px monospace;color:#7dff9a;background:#000a;padding:6px 0">?roster=v1&amp;gait=v2</div>
    <div style="position:absolute;left:718px;top:0;width:4px;height:1280px;background:#fff"></div></body>`);
  await page.waitForTimeout(1500);
  const fr = page.frames().slice(1);
  const [fL, fV] = [fr.find((f) => f.url().endsWith(base + qL)), fr.find((f) => f.url().endsWith(base + qR))];
  if (!fL || !fV) fail('ab: iframes not found');
  await stepBoot(fL); await stepBoot(fV);
  await fL.evaluate(VANGUARD_SCRIPT); await fV.evaluate(VANGUARD_SCRIPT);
  const vw = videoWriter(OUT + file);
  let same = 0, n = 0;
  for (let f = 0; f < FR; f++) {
    await fL.evaluate(() => window.__frame(2)); await fV.evaluate(() => window.__frame(2));
    await vw.write(await page.screenshot({ type: 'jpeg', quality: 88 }));
    if (f % 30 === 0) {
      const st = () => window.__gs.enemies.getChildren().filter((e) => e.active).map((e) => `${e.x.toFixed(2)},${e.y.toFixed(2)},${e.hp},${e._shieldFacing?.toFixed?.(4)}`).join('|') + `#${window.__gs.player.x.toFixed(2)}#${window.__gs._vanguardFront?.why}`;
      n++; if (await fL.evaluate(st) === await fV.evaluate(st)) same++;
    }
  }
  await vw.end();
  console.log('wrote', OUT + file, `— the same fight (sampled state identical) at ${same}/${n} checkpoints`);
  await page.close();
  return { same, n };
}

const steps = {
  sheets, facings, sidearm, colliders, gaitframes: gaitFrames, idle: shieldIdle, blockstrip: blockStrip, superstrip: superStrip, hier: hierarchy,
  gaitlive: () => encounterVideo(`${FLAGS}&${VANGUARD}`, 'bulwark-gait-v2-live.webm', 330),
  blocklive: blockLive, rapid: rapidLive, superlive: superLive,
  vanguard: () => encounterVideo(`${FLAGS}&${VANGUARD}`, 'bulwark-vanguard-live.webm', 700),
  ab: () => ab(`move=v22&${VANGUARD}`, 'bulwark-v1-ab.webm', 660),
};
const STILLS = ['sheets', 'facings', 'sidearm', 'colliders', 'gaitframes', 'idle', 'blockstrip', 'superstrip', 'hier'];
const VIDEOS = ['gaitlive', 'blocklive', 'rapid', 'superlive', 'vanguard', 'ab'];
const todo = ARGS.length ? ARGS.flatMap((a) => (a === 'stills' ? STILLS : a === 'videos' ? VIDEOS : a === 'all' ? [...STILLS, ...VIDEOS] : [a])) : [...STILLS, ...VIDEOS];
for (const s of todo) { if (!steps[s]) fail(`unknown step ${s}`); console.log('──', s); await steps[s](); }
await browser.close();
