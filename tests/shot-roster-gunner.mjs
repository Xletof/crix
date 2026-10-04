// ROSTER PHASE 2A — EVIDENCE for the Gunner Regular + Elite vertical slice.
//
// Everything here is the REAL runtime: real spawns through `spawnEnemyAt`, the
// real elite path, the real weapon placement in `Enemy.preUpdate` and real
// bolts from `fireShooter`. Nothing is redrawn for the camera.
//
// THE LOOP IS DRIVEN BY HAND. Headless Chromium runs this game at ~12fps, which
// is slower than the 14fps walk cycle — a video recorded off the live loop
// would alias the very animation it exists to show. So every session sleeps
// the loop and steps it at exactly 1000/60 per tick (`game.step`), and the
// videos are encoded at 30fps from every second tick: real speed, real
// cadence, every animation frame on screen for as long as it is on a phone.
//
// `Date.now` is stepped with it. Phaser's tween manager measures its delta off
// `Date.now()`, so a hand-stepped loop with a live wall clock runs every tween
// (the gate telegraph that drops each spawn among them) at whatever speed the
// box manages — and two "matched" sessions diverge at the first spawn. With
// the clock stepped and `Math.random` seeded, legacy and v1 run the SAME
// fight, frame for frame; `smoke-roster-gunner` asserts exactly that.
//
// usage: node tests/shot-roster-gunner.mjs <sheets|facings|weapon|colliders|live|ab|controlled|all> [outdir]

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const MODE = process.argv[2] || 'all';
const OUT = process.argv[3] || new URL('../docs/evidence/roster-gunner-v1/', import.meta.url).pathname;
const BASE = 'http://localhost:5173/';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const FFMPEG = '/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux';
// CROSSFIRE (four Gunners lead, Gunner/Rifleman fill) in the Reactor Junction
// at sector 14, where the elite roll is 0.40 — so the same wave carries both
// tiers. Seed 4242 puts three elites and four regulars on the floor.
const ENC = 'encdbg=crossfire&room=corridor&sector=14&wave=1';
const SEED = 4242;
// Stills and the controlled clip stand on the Detention Block's open escort
// floor: no cover in its middle, so nothing occludes the actors.
const STILL = 'encdbg=1&room=detention&sector=1';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const fail = (m) => { console.error(`FAIL: ${m}`); process.exit(1); };

// ── a seeded, hand-stepped session in a page or an iframe ────────────────
async function stepBoot(frame) {
  await frame.waitForFunction(() => window.game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 45000 });
  await frame.evaluate(async (seed) => {
    const g = window.game;
    g.loop.sleep();
    let s = 12345;
    Math.random = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    window.Phaser?.Math?.RND?.sow?.(['crix-gunner']);
    window.__t = 100000;
    Date.now = () => window.__t;
    window.__adv = (n = 1) => { for (let i = 0; i < n; i++) { window.__t += 1000 / 60; g.step(window.__t, 1000 / 60); } };
    g.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed });
    window.__adv(2);
    const url = performance.getEntriesByType('resource').map((r) => r.name).find((n) => /systems\/debug\.js/.test(n));
    window.__dbg = await import(url);
    window.__dbg.setGodMode(true);
    window.__gs = g.scene.getScene('Game');
    // `loadRoom` runs on a 200ms delayed call: until then the world is the
    // 720x1280 default and anything placed past it is pushed back inside
    for (let i = 0; i < 300 && !window.__gs.roomSpec; i++) window.__adv(1);
    window.__adv(20);
    // shutter hygiene: camera flash, sector wash, banners and the encdbg strip
    window.__quiet = () => {
      const gs = window.__gs, hud = g.scene.getScene('HUD');
      gs.cameras.main.resetFX();
      gs._sectorTint?.setAlpha(0);
      if (hud) {
        hud.banner?.setAlpha(0);
        if (hud.encText) for (const o of hud.children.list) if (o.depth >= 47 && o.depth <= 49) o.setVisible(false);
      }
    };
  }, SEED);
}

// ── video: every frame a JPEG screenshot, piped into the bundled ffmpeg ──
function videoWriter(file, fps = 30) {
  // Playwright's own ffmpeg build: `pipe:0` (no `-` alias) and mjpeg in, vp8 out.
  const ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(fps), '-i', 'pipe:0',
    '-vf', 'format=yuv420p', '-c:v', 'vp8', '-b:v', '6M', '-crf', '6', '-qmin', '2', '-qmax', '28', '-auto-alt-ref', '0', file]);
  ff.stderr.on('data', (d) => process.stderr.write(d));
  // an encoder that died must stop the rig, not leave it waiting on 'drain'
  ff.stdin.on('error', (e) => fail(`ffmpeg stdin: ${e.message}`));
  let ended = false;
  ff.on('exit', (code) => { if (!ended && code) fail(`ffmpeg exited ${code}`); });
  return {
    write: (buf) => new Promise((res) => { if (ff.stdin.write(buf)) res(); else ff.stdin.once('drain', res); }),
    end: () => new Promise((res) => { ended = true; ff.on('close', res); ff.stdin.end(); }),
  };
}

// ── composition: PNG cells onto one labelled canvas ──────────────────────
async function compose(file, { title, cols, cellW, cellH, cells, legend = [], bg = '#181a1f' }) {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const url = await page.evaluate(async ({ title, cols, cellW, cellH, cells, legend, bg }) => {
    const pad = 10, head = title ? 34 : 6, lab = 18, legH = legend.length * 18 + (legend.length ? 10 : 0);
    const rows = Math.ceil(cells.length / cols);
    const W = pad + cols * (cellW + pad), H = head + rows * (cellH + lab + pad) + legH + pad;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    x.fillStyle = bg; x.fillRect(0, 0, W, H);
    x.fillStyle = '#e4e7ee'; x.font = 'bold 16px monospace'; if (title) x.fillText(title, pad, 23);
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i]; if (!cell) continue;
      const cx = pad + (i % cols) * (cellW + pad), cy = head + Math.floor(i / cols) * (cellH + lab + pad);
      x.fillStyle = '#aab0bd'; x.font = '12px monospace'; x.fillText(cell.label || '', cx, cy + 13);
      if (cell.png) {
        const img = new Image(); img.src = cell.png; await img.decode();
        x.drawImage(img, cx, cy + lab, cellW, cellH);
      }
    }
    let ly = H - legH - pad + 14;
    x.font = '12px monospace';
    for (const [col, text] of legend) { x.fillStyle = col; x.fillRect(pad, ly - 9, 10, 10); x.fillStyle = '#d0d4dc'; x.fillText(text, pad + 16, ly); ly += 18; }
    return c.toDataURL('image/png');
  }, { title, cols, cellW, cellH, cells, legend, bg });
  writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
  await page.close();
  console.log('wrote', file);
}
const b64 = (buf) => `data:image/png;base64,${buf.toString('base64')}`;

// A frozen actor: the AI yields (`_performing`), the base class's presentation
// still runs every frame — facing, flip, idle animation, weapon placement — so
// what is photographed is what the runtime draws for that aim.
const FREEZE = () => {
  window.__freeze = (e, aim) => { e._performing = true; e._movePlanted = true; e._aim = aim; e.setVelocity?.(0, 0); };
};

// Stills only: the room's FLOOR stays (backdrop, decals, perimeter) and its
// furniture goes — cover, props, terminals, pickups, and their bodies with
// them so nothing pushes a frozen actor. The live videos keep the whole room.
async function quietRoom(page) {
  await page.evaluate(() => {
    const gs = window.__gs;
    gs.arenaActive = false; gs._roomModifier = null; gs.events.emit('set-darkness', false);
    for (const e of gs.enemies.getChildren().slice()) gs._destroyEnemyFully(e);
    for (const o of gs.roomLayer.getChildren()) {
      if ((o.displayWidth || 0) >= 1000) continue;
      o.setVisible(false); if (o.body) o.body.enable = false;
    }
    for (const t of gs.terminals || []) { for (const k of Object.values(t)) if (k?.setVisible) k.setVisible(false); t.setVisible?.(false); }
    for (const w of gs.weaponPickups || []) { w.setVisible?.(false); for (const k of Object.values(w)) if (k?.setVisible) k.setVisible(false); }
    for (const o of gs.children.list) if (o.type === 'Text') o.setVisible(false);
    for (const q of gs.envLight?.parts || []) (q.img || q.image || q)?.setVisible?.(false);
    gs.cameraDirector.update = () => {};              // the rig places the camera
    window.__adv(1);
  });
}

// ── SHEETS: the production textures themselves, 1x, every frame labelled ──
async function sheets() {
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  await page.goto(BASE + '?nodlg=1&roster=v1');
  await page.waitForFunction(() => window.game?.textures?.exists('ro-gun-E'), null, { timeout: 45000 });
  for (const [key, file, title] of [
    ['ro-gun-R', 'gunner-v1-sheet-regular.png', 'GUNNER REGULAR — ro-gun-R — 33 frames, 24x26 logical @4 (96x104), 1x'],
    ['ro-gun-E', 'gunner-v1-sheet-elite.png', 'GUNNER ELITE — ro-gun-E — 33 frames, 24x26 logical @4 (96x104), 1x'],
  ]) {
    const url = await page.evaluate(({ key, title }) => {
      const src = window.game.textures.get(key).getSourceImage();
      const fw = 96, fh = 104, gap = 10, lab = 16, left = 74, top = 40;
      const rows = [
        ['FRONT', 0, ['0 idle', '1 walk', '2 walk', '3 walk', '4 walk', '5 walk', '6 walk', '7 fire']],
        ['BACK', 8, ['8 idle', '9 walk', '10 walk', '11 walk', '12 walk', '13 walk', '14 walk', '15 fire']],
        ['SIDE (E)', 16, ['16 idle', '17 walk', '18 walk', '19 walk', '20 walk', '21 walk', '22 walk', '23 fire']],
        ['POSES', 24, ['24 F raise', '25 F thrust', '26 F recoil', '27 B raise', '28 B thrust', '29 B recoil', '30 S raise', '31 S thrust', '32 S recoil']],
      ];
      const W = left + 9 * (fw + gap) + gap, H = top + rows.length * (fh + lab + gap) + 30;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
      x.fillStyle = '#212328'; x.fillRect(0, 0, W, H);
      x.fillStyle = '#e4e7ee'; x.font = 'bold 14px monospace'; x.fillText(title, 10, 24);
      rows.forEach(([name, base, labels], ri) => {
        const y0 = top + ri * (fh + lab + gap);
        x.fillStyle = '#c8ccd6'; x.font = 'bold 12px monospace'; x.fillText(name, 8, y0 + lab + fh / 2);
        labels.forEach((l, i) => {
          const x0 = left + i * (fw + gap);
          x.fillStyle = '#8a8f9c'; x.font = '11px monospace'; x.fillText(l, x0, y0 + 12);
          x.drawImage(src, (base + i) * fw, 0, fw, fh, x0, y0 + lab, fw, fh);
        });
      });
      x.fillStyle = '#8a8f9c'; x.font = '11px monospace';
      x.fillText('deck #212328 behind every frame. West = the SIDE block mirrored by flipX at runtime.', 10, H - 10);
      return c.toDataURL('image/png');
    }, { key, title });
    writeFileSync(OUT + file, Buffer.from(url.split(',')[1], 'base64'));
    console.log('wrote', OUT + file);
  }
  await page.close();
}

// ── FACINGS: Regular, Elite, unchanged Captain — front/back/east/west at 1x ─
async function facings() {
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  page.on('pageerror', (e) => fail(`facings: ${e.message}`));
  await page.goto(BASE + `?nodlg=1&nofreeze=1&roster=v1&${STILL}`);
  await stepBoot(page);
  await quietRoom(page);
  await page.evaluate(FREEZE);
  const shot = await page.evaluate(() => {
    const gs = window.__gs;
    const cam = gs.cameras.main;
    const X0 = 600, Y0 = 560, DX = 150, DY = 180;
    const P = gs.player; P.setPosition(X0 + 300, Y0 + 900); P.body.reset(P.x, P.y); P.setVisible(false); P.weaponSprite?.setVisible(false);
    cam.setScroll(X0 - 170, Y0 - 150);
    const dirs = [['FRONT (S)', Math.PI / 2], ['BACK (N)', -Math.PI / 2], ['SIDE (E)', 0], ['WEST (flip)', Math.PI]];
    const rows = ['REGULAR v1', 'ELITE v1', 'SHOCK CAPTAIN'];
    const lab = (x, y, t) => gs.add.text(x, y, t, { fontFamily: 'monospace', fontSize: '12px', color: '#e4e7ee', backgroundColor: '#0008' }).setOrigin(0.5).setDepth(9999);
    dirs.forEach(([name, aim], c) => {
      lab(X0 + c * DX, Y0 - 95, name);
      rows.forEach((r, ri) => {
        const x = X0 + c * DX, y = Y0 + ri * DY;
        let e;
        if (ri === 2) {
          e = gs.spawnChampion(x, y, 'captain');
          window.__freeze(e, aim);
          const { dir } = e._facingSuffix();
          e.play(`${e._animPrefix}-idle-${dir}`);
        } else {
          e = gs.spawnEnemyAt('shooter', x, y, ri === 1 ? { elite: true } : {});
          window.__freeze(e, aim);
        }
        e.body.reset(x, y);
        if (c === 0) lab(x - 74, y, r).setOrigin(1, 0.5);
      });
    });
    window.__adv(3);
    window.__quiet();
    window.__adv(1);
    const top = cam.y;
    return { x: 0, y: top, w: 720, h: 640 };
  });
  const buf = await page.screenshot({ clip: { x: 0, y: shot.y, width: 720, height: 600 } });
  await compose(OUT + 'gunner-v1-facings.png', {
    title: 'GUNNER v1 — Regular / Elite / unchanged Shock Captain — live runtime, 1x',
    cols: 1, cellW: 720, cellH: 600,
    cells: [{ label: 'rows: REGULAR v1, ELITE v1, SHOCK CAPTAIN (frozen, untouched). Columns: aim S / N / E / W. Weapons placed by Enemy.preUpdate.', png: b64(buf) }],
  });
  await page.close();
}

// ── WEAPON: pivot, gameplay spawn, the real bolt and the drawn muzzle ───────
async function weapon() {
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  page.on('pageerror', (e) => fail(`weapon: ${e.message}`));
  await page.goto(BASE + `?nodlg=1&nofreeze=1&roster=v1&${STILL}`);
  await stepBoot(page);
  await quietRoom(page);
  await page.evaluate(FREEZE);
  const AIMS = [['E 0°', 0], ['SE', Math.PI / 4], ['S', Math.PI / 2], ['SW', 3 * Math.PI / 4], ['W 180°', Math.PI], ['NW', -3 * Math.PI / 4], ['N', -Math.PI / 2], ['NE', -Math.PI / 4]];
  const TIERS = [['REGULAR v1', { }, false], ['ELITE v1', { elite: true }, false], ['LEGACY regular (reference)', { legacyArt: true }, true]];
  const cells = [];
  const nums = [];
  for (const [tname, spec] of TIERS) {
    for (const [aname, aim] of AIMS) {
      const r = await page.evaluate(({ spec, aim }) => {
        const gs = window.__gs, cam = gs.cameras.main;
        for (const e of gs.enemies.getChildren().slice()) gs._destroyEnemyFully(e);
        gs.enemyBullets.getChildren().forEach((b) => b.disableBody?.(true, true));
        window.__ann?.destroy();
        const X = 700, Y = 650;
        const P = gs.player; P.setPosition(X + Math.cos(aim) * 420, Y + Math.sin(aim) * 420); P.body.reset(P.x, P.y); P.setVisible(false); P.weaponSprite?.setVisible(false);
        const e = gs.spawnEnemyAt('shooter', X, Y, spec);
        window.__freeze(e, aim); e.body.reset(X, Y);
        cam.setZoom(2); cam.centerOn(X, Y);
        window.__adv(2);
        const ws = e.weaponSprite;
        const m = new window.Phaser.Math.Vector2();
        ws.getWorldTransformMatrix().transformPoint((1 - ws.originX) * ws.width, 0, m);   // the right edge ON the pivot row
        gs.fireShooter(e, aim);
        const b = gs.enemyBullets.getChildren().find((q) => q.active);
        const S = { x: b.x, y: b.y };
        const g = window.__ann = gs.add.graphics().setDepth(9990);
        const c = Math.cos(aim), s = Math.sin(aim), n = { x: -s, y: c };
        g.lineStyle(1, 0xffffff, 0.35); g.lineBetween(X - c * 30, Y - s * 30, X + c * 120, Y + s * 120);
        g.lineStyle(2, 0x40e0ff, 1); g.lineBetween(ws.x - 5, ws.y, ws.x + 5, ws.y); g.lineBetween(ws.x, ws.y - 5, ws.x, ws.y + 5);
        g.fillStyle(0xff40d0, 1); g.fillCircle(S.x, S.y, 2.5);
        g.lineStyle(2, 0xffe040, 1); g.lineBetween(m.x + n.x * 9, m.y + n.y * 9, m.x - n.x * 9, m.y - n.y * 9);
        window.__adv(1);                       // the bolt's FIRST RENDERED frame (one physics step)
        // where the bolt IS on that frame, most of it hidden under the gun: a
        // bracket beside the axis from its tail to its leading edge
        const F = { x: b.x, y: b.y }, hb = b.displayWidth / 2, off = 9;
        g.lineStyle(2, 0x10ee10, 0.9);
        g.lineBetween(F.x - c * hb + n.x * off, F.y - s * hb + n.y * off, F.x + c * hb + n.x * off, F.y + s * hb + n.y * off);
        g.lineBetween(F.x + c * hb + n.x * (off - 4), F.y + s * hb + n.y * (off - 4), F.x + c * hb + n.x * (off + 4), F.y + s * hb + n.y * (off + 4));
        window.__quiet();
        window.game.step(window.__t, 0);       // re-render the same instant with the bracket on it
        const along = (q) => (q.x - X) * c + (q.y - Y) * s;
        const scr = { x: (X - cam.worldView.x) * cam.zoom + cam.x, y: (Y - cam.worldView.y) * cam.zoom + cam.y };
        return { scr, pivot: along(ws), spawn: along(S), first: along(b), half: b.displayWidth / 2, muzzle: along(m), radius: e.cfg.radius, depthGun: ws.depth - e.y };
      }, { spec, aim });
      const W = 300;
      const buf = await page.screenshot({ clip: { x: Math.round(r.scr.x - W / 2), y: Math.round(r.scr.y - W / 2), width: W, height: W } });
      cells.push({ label: `${tname.split(' ')[0]} ${aname}${r.depthGun < 0 ? ' (gun behind)' : ''}`, png: b64(buf) });
      nums.push({ tier: tname, aim: aname, radius: r.radius, pivot: +r.pivot.toFixed(1), spawn: +r.spawn.toFixed(1), boltHeadAtSpawn: +(r.spawn + r.half).toFixed(1), firstRenderHead: +(r.first + r.half).toFixed(1), muzzle: +r.muzzle.toFixed(1) });
    }
  }
  await page.evaluate(() => { window.__gs.cameras.main.setZoom(1); });
  await compose(OUT + 'gunner-v1-weapon.png', {
    title: 'GUNNER v1 WEAPON — real overlay + a real bolt on its first rendered frame (2x camera zoom)',
    cols: 8, cellW: 300, cellH: 300, cells,
    legend: [
      ['#40e0ff', 'weapon ORIGIN / pivot — cfg.radius - 4 along the aim (Enemy.preUpdate, frozen)'],
      ['#ff40d0', 'GAMEPLAY SPAWN — cfg.radius + 4 (fireShooter, frozen): the bolt\'s centre when it is fired'],
      ['#ffe040', 'DRAWN MUZZLE — outer edge of the gun silhouette, on the bolt axis'],
      ['#10ee10', 'the real bolt on its FIRST RENDERED frame (one 60fps physics step after spawn), drawn at depth 26 UNDER gun and body; the bracket beside the axis is its full length, tick = leading edge'],
      ['#ffffff', 'aim axis'],
      ['#aab0bd', 'v1, both tiers: muzzle = origin + 54 = spawn + 46, where the bolt\'s leading edge is on the first frame it is drawn (origin + 53.6). Legacy: muzzle = spawn + 53, edge 7.7px inside it.'],
    ],
  });
  writeFileSync(OUT + 'gunner-v1-weapon-numbers.json', JSON.stringify(nums, null, 1));
  console.table(nums.filter((q, i) => i % 4 === 0));
  await page.close();
}

// ── COLLIDERS: debug overlay, legacy and v1 side by side ───────────────────
async function colliders() {
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  page.on('pageerror', (e) => fail(`colliders: ${e.message}`));
  await page.goto(BASE + `?nodlg=1&nofreeze=1&roster=v1&colliders=1&${STILL}`);
  await stepBoot(page);
  await quietRoom(page);
  await page.evaluate(FREEZE);
  const cells = [];
  for (const zoom of [1, 2]) {
    const r = await page.evaluate((zoom) => {
      const gs = window.__gs, cam = gs.cameras.main;
      for (const e of gs.enemies.getChildren().slice()) gs._destroyEnemyFully(e);
      for (const t of window.__labs || []) t.destroy();
      window.__labs = [];
      const X0 = 520, Y0 = 600, DX = zoom === 1 ? 150 : 88, DY = zoom === 1 ? 150 : 130;
      const P = gs.player; P.setPosition(X0, Y0 + 700); P.body.reset(P.x, P.y); P.setVisible(false); P.weaponSprite?.setVisible(false);
      const who = [['LEGACY R', { legacyArt: true }, false], ['v1 R', {}, false], ['LEGACY E', { legacyArt: true }, true], ['v1 E', { elite: true }, false]];
      const out = [];
      who.forEach(([name, spec, legacyElite], i) => {
        for (const [row, aim] of [[0, Math.PI / 2], [1, 0]]) {
          const x = X0 + i * DX, y = Y0 + row * DY;
          const e = gs.spawnEnemyAt('shooter', x, y, spec);
          if (legacyElite) gs._makeElite(e, { legacyLook: true });
          window.__freeze(e, aim); e.body.reset(x, y);
          if (row === 0) window.__labs.push(gs.add.text(x, y - 66, name, { fontFamily: 'monospace', fontSize: zoom === 1 ? '12px' : '8px', color: '#e4e7ee', backgroundColor: '#000a', resolution: 4 }).setOrigin(0.5).setDepth(9999));
          if (row === 0) out.push({ name, bodyW: e.body.width, radius: e.cfg.radius, scale: e.scaleX, tex: e.texture.key });
        }
      });
      cam.setZoom(zoom);
      cam.centerOn(X0 + 1.5 * DX, Y0 + DY / 2);
      window.__adv(3); window.__quiet(); window.__adv(1);
      const top = (Y0 - 90 - cam.worldView.y) * zoom + cam.y, bot = (Y0 + DY + 70 - cam.worldView.y) * zoom + cam.y;
      return { out, top, h: bot - top };
    }, zoom);
    const buf = await page.screenshot({ clip: { x: 0, y: Math.round(r.top), width: 720, height: Math.round(r.h) } });
    cells.push({ label: zoom === 1 ? 'GAMEPLAY SCALE (1x). Top row aim S, bottom row aim E.' : 'INSPECTION (2x camera zoom), same four actors', png: b64(buf), h: Math.round(r.h) });
    if (zoom === 1) console.table(r.out);
  }
  // two cells of different heights: compose them as one column at their own size
  for (const [i, c] of cells.entries()) {
    await compose(OUT + `gunner-v1-colliders${i ? '-2x' : ''}.png`, {
      title: i ? 'GUNNER COLLIDERS (2x inspection) — ?colliders=1' : 'GUNNER COLLIDERS — ?colliders=1, gameplay scale',
      cols: 1, cellW: 720, cellH: c.h, cells: [{ label: c.label, png: c.png }],
    legend: [
      ['#40ff80', 'physics body: regular 44px wide; elite 84px wide (legacy r30 x render scale 1.4, v1 r42 x 1.0)'],
      ['#ffe040', 'cfg.radius: what a bolt must touch — regular 22, elite 30, identical in legacy and v1'],
    ],
    });
  }
  await page.close();
}

// ── a scripted player for the encounter videos (identical in every session) ─
// Ticks are 60 Hz game ticks. Movement keys are written straight into the
// scene's Key objects (they are what `update` reads), fire is the keyboard
// path's own `keyboardFire()` — no DOM events, so it works in an iframe and
// both halves of the A/B receive exactly the same input on the same tick.
const PLAYER_SCRIPT = `
  window.__drive = (i) => {
    const gs = window.__gs, k = gs.keys; if (!k) return;
    const seg = [[0,150,''],[150,250,'D'],[250,300,''],[300,410,'A'],[410,470,''],[470,550,'W'],[550,640,'S'],[640,700,''],
                 [700,790,'D'],[790,880,'A'],[880,980,''],[980,1060,'S'],[1060,1140,'W'],[1140,99999,'']];
    const cur = seg.find(([a,b]) => i >= a && i < b)[2];
    k.A.isDown = cur === 'A'; k.D.isDown = cur === 'D'; k.W.isDown = cur === 'W'; k.S.isDown = cur === 'S';
    if (i >= 700 && i % 10 === 0) gs.player.keyboardFire();
  };
  window.__tick = 0;
  window.__frame = (n) => { for (let j = 0; j < n; j++) { window.__drive(window.__tick++); window.__adv(1); } window.__quiet(); };
`;

async function live(file = 'gunner-v1-live-1x.webm', FR = 600) {
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  page.on('pageerror', (e) => fail(`live: ${e.message}`));
  await page.goto(BASE + `?nodlg=1&nofreeze=1&roster=v1&${ENC}${MOVE_EXTRA}`);
  await stepBoot(page);
  await page.evaluate(PLAYER_SCRIPT);
  const vw = videoWriter(OUT + file);              // FR frames at 30fps, two game ticks each
  for (let f = 0; f < FR; f++) {
    await page.evaluate(() => window.__frame(2));
    await vw.write(await page.screenshot({ type: 'jpeg', quality: 90 }));
    if (f % 100 === 0) console.log('live frame', f, await page.evaluate(() => window.__gs.enemies.getChildren().filter((e) => e.active).map((e) => e.texture.key).join(',')));
  }
  await vw.end();
  console.log('wrote', OUT + file);
  await page.close();
}

async function ab(qL = '', qR = '&roster=v1', labL = 'LEGACY (default)', labR = '?roster=v1', file = 'gunner-v1-ab.webm', FR = 600) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1280 } });
  const q = `?nodlg=1&nofreeze=1&${ENC}`;
  await page.setContent(`<body style="margin:0;background:#000;display:flex;position:relative">
    <iframe id="L" src="${BASE}${q}${qL}" width="720" height="1280" style="border:0"></iframe>
    <iframe id="V" src="${BASE}${q}${qR}" width="720" height="1280" style="border:0"></iframe>
    <div style="position:absolute;left:0;top:1236px;width:720px;text-align:center;font:bold 22px monospace;color:#fff;background:#000a;padding:6px 0">${labL}</div>
    <div style="position:absolute;left:720px;top:1236px;width:720px;text-align:center;font:bold 22px monospace;color:#7dff9a;background:#000a;padding:6px 0">${labR}</div>
    <div style="position:absolute;left:718px;top:0;width:4px;height:1280px;background:#fff"></div></body>`);
  await page.waitForTimeout(1500);
  const fr = page.frames().slice(1);
  const [fL, fV] = [fr.find((f) => f.url().endsWith(q + qL)), fr.find((f) => f.url().endsWith(q + qR))];
  if (!fL || !fV) fail('ab: iframes not found');
  for (const f of [fL, fV]) f.page().on('pageerror', (e) => fail(`ab: ${e.message}`));
  await stepBoot(fL); await stepBoot(fV);
  await fL.evaluate(PLAYER_SCRIPT); await fV.evaluate(PLAYER_SCRIPT);
  const vw = videoWriter(OUT + file);
  let drift = 0;
  for (let f = 0; f < FR; f++) {
    await fL.evaluate(() => window.__frame(2)); await fV.evaluate(() => window.__frame(2));
    await vw.write(await page.screenshot({ type: 'jpeg', quality: 88 }));
    if (f % 30 === 0) {
      const st = () => window.__gs.enemies.getChildren().filter((e) => e.active).map((e) => `${e.x.toFixed(2)},${e.y.toFixed(2)},${e.hp}`).join('|') + `#${window.__gs.player.x.toFixed(2)}`;
      const [a, b] = [await fL.evaluate(st), await fV.evaluate(st)];
      if (a !== b) drift++;
    }
  }
  await vw.end();
  console.log('wrote', OUT + file, `— sampled state identical at ${Math.ceil(FR / 30) - drift}/${Math.ceil(FR / 30)} checkpoints`);
  await page.close();
}

// ── CONTROLLED: legacy and v1, both tiers, the same scripted walk/fire ──────
async function controlled() {
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  page.on('pageerror', (e) => fail(`controlled: ${e.message}`));
  await page.goto(BASE + `?nodlg=1&nofreeze=1&roster=v1&${STILL}`);
  await stepBoot(page);
  await quietRoom(page);
  await page.evaluate(() => {
    const gs = window.__gs, cam = gs.cameras.main;
    // each actor walks a ~150px square east-then-south from its start, so the
    // columns are spaced to keep the four squares apart and inside the frame
    const X0 = 400, Y0 = 470, DX = 280, DY = 300;
    const P = gs.player; P.setPosition(X0 + 160, Y0 + 1200); P.body.reset(P.x, P.y); P.setVisible(false); P.weaponSprite?.setVisible(false);
    cam.setScroll(X0 - 200, Y0 - 250);
    const who = [['LEGACY regular', { legacyArt: true }, false, 0, 0], ['v1 REGULAR', {}, false, 1, 0], ['LEGACY elite', { legacyArt: true }, true, 0, 1], ['v1 ELITE', { elite: true }, false, 1, 1]];
    const actors = [];
    for (const [name, spec, legacyElite, cx, cy] of who) {
      const x = X0 + cx * DX, y = Y0 + cy * DY;
      const e = gs.spawnEnemyAt('shooter', x, y, spec);
      if (legacyElite) gs._makeElite(e, { legacyLook: true });
      const enemyProto = Object.getPrototypeOf(Object.getPrototypeOf(e));
      e.preUpdate = function (t, d) { enemyProto.preUpdate.call(this, t, d); };    // presentation only — the script drives
      e.body.reset(x, y);
      gs.add.text(x + 75, y - 95, name, { fontFamily: 'monospace', fontSize: '14px', color: '#e4e7ee', backgroundColor: '#000a', padding: { x: 4, y: 2 } }).setOrigin(0.5).setDepth(9999);
      actors.push({ e, x, y });
    }
    // walk a square (E, S, W, N), stopping to fire twice at each corner along the
    // facing it just walked — the shot sequence `_maybeFireAt` runs: weapon
    // warn tint 300ms ahead, then recoilT 100, fire frame 180ms, a real bolt.
    const beats = [];
    const leg = (ang, ms) => beats.push({ kind: 'walk', ang, ms });
    const shoot = (ang) => { beats.push({ kind: 'idle', ang, ms: 200 }); beats.push({ kind: 'warn', ang, ms: 300 }); beats.push({ kind: 'fire', ang, ms: 260 }); beats.push({ kind: 'warn', ang, ms: 300 }); beats.push({ kind: 'fire', ang, ms: 400 }); };
    for (const ang of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) { leg(ang, 800); shoot(ang); }
    let bi = 0, left = beats[0].ms, fired = false;
    window.__ctl = () => {
      const b = beats[bi % beats.length];
      for (const { e } of actors) {
        e._aim = b.ang;
        // the archetype's own speed with the room modifier taken back off, so
        // the stride is judged against the speed it was drawn for
        const v = b.kind === 'walk' ? e.cfg.speed / (gs.arenaCfg?.speedMult || 1) : 0;
        e.setVelocity(Math.cos(b.ang) * v, Math.sin(b.ang) * v);
        if (b.kind === 'warn' && left === b.ms) e.weaponSprite.setTint(0xff6010);
        if (b.kind === 'fire' && !fired) { e.weaponSprite.clearTint(); e.recoilT = 100; e._fireAnimTimer = 180; gs.fireShooter(e, b.ang); }
      }
      if (b.kind === 'fire') fired = true;
      left -= 1000 / 60;
      if (left <= 0) { bi++; left = beats[bi % beats.length].ms; fired = false; }
    };
    window.__frame = (n) => { for (let j = 0; j < n; j++) { window.__ctl(); window.__adv(1); } window.__quiet(); };
  });
  const vw = videoWriter(OUT + 'gunner-v1-controlled-1x.webm');
  for (let f = 0; f < 420; f++) {
    await page.evaluate(() => window.__frame(2));
    await vw.write(await page.screenshot({ type: 'jpeg', quality: 90 }));
  }
  await vw.end();
  console.log('wrote', OUT + 'gunner-v1-controlled-1x.webm');
  await page.close();
}


// ── MUZZLE DISCHARGE (polish pass): old vs new, matched, 1x ────────────────
// One page, four v1 Gunners scripted identically: the left pair with the
// muzzle event switched off on the actor (`_muzzleFx = false` — what shipped
// in 191747a), the right pair with it on. Nothing else differs, in the same
// frame. Each turns through E / S / W / N and fires two rounds per aim.
async function fireStage(page, { zoom = 1 } = {}) {
  await page.goto(BASE + `?nodlg=1&nofreeze=1&roster=v1&${STILL}`);
  await stepBoot(page);
  await quietRoom(page);
  await page.evaluate((zoom) => {
    const gs = window.__gs, cam = gs.cameras.main;
    const P = gs.player; P.setPosition(600, 1700); P.body.reset(P.x, P.y); P.setVisible(false); P.weaponSprite?.setVisible(false);
    const X0 = 380, Y0 = 520, DX = 240, DY = 300;
    // OLD = the v1 Gunner as shipped in dbf16c6 (shared orange warning tint +
    // whole-body shot squash + discharge); NEW = its own weapon cycle.
    const who = [['OLD regular', {}, false, 0, 0], ['NEW regular', {}, true, 1, 0], ['OLD elite', { elite: true }, false, 0, 1], ['NEW elite', { elite: true }, true, 1, 1]];
    const actors = [];
    for (const [name, spec, neu, cx, cy] of who) {
      const x = X0 + cx * DX, y = Y0 + cy * DY;
      const e = gs.spawnEnemyAt('shooter', x, y, spec);
      if (!neu) e._weaponFx = null;
      // the REAL firing path (`_maybeFireAt`), with sight and line forced true
      // and the cooldown pinned so all four fire on the same tick
      e.canSee = () => true; e._hasLOS = () => true;
      const enemyProto = Object.getPrototypeOf(Object.getPrototypeOf(e));
      e.preUpdate = function (t, d) { enemyProto.preUpdate.call(this, t, d); };
      e.body.reset(x, y);
      if (zoom === 1) gs.add.text(x, y - 110, name, { fontFamily: 'monospace', fontSize: '14px', color: neu ? '#9dffb2' : '#e4e7ee', backgroundColor: '#000a', padding: { x: 4, y: 2 } }).setOrigin(0.5).setDepth(9999);
      e.fireCd = 600;
      actors.push(e);
    }
    if (zoom === 1) cam.setScroll(X0 - 180, Y0 - 260);
    else { cam.setZoom(zoom); cam.centerOn(X0 + DX / 2 + 30, Y0); }
    window.__fa = actors;
    const aims = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
    let tick = 0, shots = 0; window.__shotTick = -1;
    window.__ctl = () => {
      const ang = aims[Math.floor(shots / 2) % 4];
      for (const e of actors) {
        e._aim = ang; e.setVelocity(0, 0);
        const before = e.fireCd;
        e._maybeFireAt(1000 / 60, { x: e.x + Math.cos(ang) * 300, y: e.y + Math.sin(ang) * 300 });
        if (e.fireCd > before) e.fireCd = 800;          // pinned cadence: the shot fired this tick
      }
      if (actors[0].fireCd === 800) { window.__shotTick = tick; shots++; actors.forEach((e) => { e.fireCd = 799.99; }); }
      tick++; window.__tick = tick;
    };
    window.__frame = (n) => { for (let j = 0; j < n; j++) { window.__ctl(); window.__adv(1); } window.__quiet(); };
  }, zoom);
}

async function firefx() {
  // 1. matched A/B video, 1x, 30fps from 60Hz ticks
  let page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  page.on('pageerror', (e) => fail(`firefx: ${e.message}`));
  await fireStage(page);
  const vw = videoWriter(OUT + 'gunner-firefx-v1-ab.webm');
  for (let f = 0; f < 300; f++) { await page.evaluate(() => window.__frame(2)); await vw.write(await page.screenshot({ type: 'jpeg', quality: 92 })); }
  await vw.end(); console.log('wrote', OUT + 'gunner-firefx-v1-ab.webm');
  await page.close();
  // 2. the event tick by tick (60Hz), from the shot, at 1x and 3x
  page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  page.on('pageerror', (e) => fail(`firefx strip: ${e.message}`));
  await fireStage(page);
  await page.evaluate(() => { while (window.__shotTick < 0) window.__frame(1); });   // first shot (aim E) fired this tick
  const cells1 = [], cells3 = [];
  const lab = ['shot tick', '+1 (16ms)', '+2 (33ms)', '+3 (50ms)', '+4 (67ms)', '+5 (83ms)', '+6 (100ms)'];
  for (let k = 0; k < 7; k++) {
    if (k) await page.evaluate(() => window.__frame(1));
    const at = await page.evaluate(() => {
      const cam = window.__gs.cameras.main;
      return window.__fa.map((e) => ({ x: (e.x - cam.worldView.x) * cam.zoom + cam.x, y: (e.y - cam.worldView.y) * cam.zoom + cam.y }));
    });
    for (const [i, row] of [[0, 'OLD R'], [1, 'NEW R'], [3, 'NEW E']]) {
      const c = at[i], clip = { x: Math.round(c.x - 30), y: Math.round(c.y - 60), width: 140, height: 120 };
      const buf = await page.screenshot({ clip });
      cells1.push({ label: `${row} ${lab[k]}`, png: b64(buf) });
      if (i) cells3.push({ label: `${row} ${lab[k]}`, png: b64(await page.screenshot({ clip: { x: Math.round(c.x + 50), y: Math.round(c.y - 22), width: 70, height: 44 } })) });
    }
  }
  // reorder so each row is one actor across time
  const byRow = (cells, n) => { const out = []; for (let r = 0; r < n; r++) for (let k = 0; k < 7; k++) out.push(cells[k * n + r]); return out; };
  await compose(OUT + 'gunner-firefx-v1-strip.png', {
    title: 'GUNNER MUZZLE DISCHARGE — 60Hz ticks from the shot, aim E. Rows: OLD regular, NEW regular, NEW elite (1x)',
    cols: 7, cellW: 140, cellH: 120, cells: byRow(cells1, 3),
  });
  await compose(OUT + 'gunner-firefx-v1-strip-3x.png', {
    title: 'INSPECTION 3x — muzzle region only. Rows: NEW regular, NEW elite',
    cols: 7, cellW: 210, cellH: 132, cells: byRow(cells3, 2),
  });
  await page.close();
  // 3. a real encounter at real speed
  await live('gunner-firefx-v1-live.webm', 300);
}

async function weaponfire(tag = 'v2') {
  const P = (n) => OUT + n;
  // 1. matched A/B, 1x
  let page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  page.on('pageerror', (e) => fail(`weaponfire: ${e.message}`));
  await fireStage(page);
  let vw = videoWriter(P(`gunner-weaponfire-${tag}-ab.webm`));
  for (let f = 0; f < 330; f++) { await page.evaluate(() => window.__frame(2)); await vw.write(await page.screenshot({ type: 'jpeg', quality: 92 })); }
  await vw.end(); console.log('wrote ab'); await page.close();
  // 2. zoom diagnostic (3x camera), same script
  page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  await fireStage(page, { zoom: 3 });
  vw = videoWriter(P(`gunner-weaponfire-${tag}-zoom.webm`));
  for (let f = 0; f < 240; f++) { await page.evaluate(() => window.__frame(2)); await vw.write(await page.screenshot({ type: 'jpeg', quality: 92 })); }
  await vw.end(); console.log('wrote zoom'); await page.close();
  // 3. strip: one shot at aim E, tick by tick (60Hz)
  page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  await fireStage(page);
  // the first shot is on aim E; shots are 48 ticks apart, aim turns every two,
  // so the third shot (first + 96) is on aim S, the camera-facing case
  await page.evaluate(() => { while (window.__shotTick < 0) window.__frame(1); });
  const first = await page.evaluate(() => window.__shotTick);
  const offs = [-24, -16, -10, -4, -1, 0, 1, 2, 3, 5, 8];
  const labels = ['idle', 'charge 33%', 'charge 67%', 'charge 89%', 'charge 100%', 'SHOT', '+16ms', '+33ms', '+50ms', '+83ms', '+133ms'];
  const cells = [];
  for (let i = 0; i < offs.length; i++) {
    const at = await page.evaluate((target) => {
      while (window.__tick < target) window.__frame(1);
      const cam = window.__gs.cameras.main;
      return window.__fa.map((e) => ({ x: (e.x - cam.worldView.x) * cam.zoom + cam.x, y: (e.y - cam.worldView.y) * cam.zoom + cam.y }));
    }, first + 96 + offs[i] + 1);
    for (const [k, row] of [[0, 'OLD R'], [1, 'NEW R'], [3, 'NEW E']]) {
      const c = at[k];
      cells.push({ k, label: `${row} ${labels[i]}`, png: b64(await page.screenshot({ clip: { x: Math.round(c.x - 60), y: Math.round(c.y - 60), width: 120, height: 150 } })) });
    }
  }
  const ordered = [0, 1, 3].flatMap((k) => cells.filter((c) => c.k === k));
  await compose(P(`gunner-weaponfire-${tag}-strip.png`), {
    title: `GUNNER WEAPON FIRE ${tag} — 60Hz ticks around one shot (aim S, 1x). Rows: OLD (shared orange tint + body squash), NEW regular, NEW elite`,
    cols: offs.length, cellW: 120, cellH: 150, cells: ordered,
  });
  await page.close();
  // 4. real CROSSFIRE
  await live(`gunner-weaponfire-${tag}-live.webm`, 360);
}

let MOVE_EXTRA = '';
const run = { sheets, facings, weapon, colliders, live: () => live(), ab, controlled, firefx, weaponfire: () => weaponfire('v3'),
  movement: () => ab('&roster=v1', '&roster=v1&move=v2', 'SHIPPED MOVEMENT', '?move=v2 CANDIDATE', 'enemy-move-v2-ab.webm', 600),
  'v3-live': async () => { MOVE_EXTRA = '&move=v2'; await live('gunner-weaponfire-v3-live-move-v2.webm', 450); } };
if (MODE === 'all') { for (const f of Object.values(run)) await f(); }
else if (run[MODE]) await run[MODE]();
else fail(`unknown mode ${MODE}`);
await browser.close();
