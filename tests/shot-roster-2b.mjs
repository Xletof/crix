// ROSTER PHASE 2B — EVIDENCE for the Rifleman (`grunt`) and Marksman (`sniper`)
// production slice. Same rules as shot-roster-gunner.mjs: the REAL runtime,
// the loop slept and stepped at exactly 1000/60, `Date.now` stepped with it,
// `Math.random` seeded, videos encoded at 30fps from every second tick.
//
// usage: node tests/shot-roster-2b.mjs <rif|mrk|both|hier|all> [outdir]
//   rif   rifleman-v1-{sheet-regular,sheet-elite,facings,weapon,colliders}.png,
//         rifleman-v1-live-1x.webm, rifleman-v1-ab.webm
//   mrk   the same for marksman-v1-*
//   both  rifleman-marksman-v1-live.webm
//   hier  roster-v1-hierarchy-3roles.png

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const MODE = process.argv[2] || 'all';
const OUT = process.argv[3] || new URL('../docs/evidence/roster-2b/', import.meta.url).pathname;
const BASE = 'http://localhost:5173/';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const FFMPEG = '/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux';
const SEED = 4242;
// stills stand on the Detention Block's open escort floor (no cover in its middle)
const STILL = 'encdbg=1&room=detention&sector=1';
// THE HANDSET CASES. Rifleman: CROSSFIRE in the Reactor Junction at sector 14
// (its opening Riflemen plus the Rifleman fill) with movement v2.2. Marksman:
// SNIPER NEST at sector 14 — two Marksmen lead, Rifleman / Marksman fill.
const ENC = {
  rif: 'encdbg=crossfire&room=corridor&sector=14&wave=1&move=v22',
  mrk: 'encdbg=sniperNest&room=corridor&sector=14&wave=1&move=v22',
};
const ROLE = {
  rif: { type: 'grunt', name: 'RIFLEMAN', file: 'rifleman', pre: 'ro-rif', legacy: 'grunt' },
  mrk: { type: 'sniper', name: 'MARKSMAN', file: 'marksman', pre: 'ro-mrk', legacy: 'shooter' },
};
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
        if (hud.encText) for (const o of hud.children.list) if (o.depth >= 47 && o.depth <= 49) o.setVisible(false);
      }
    };
    window.__freeze = (e, aim) => { e._performing = true; e._movePlanted = true; e._aim = aim; e.setVelocity?.(0, 0); };
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
      if (cell.png) { const img = new Image(); img.src = cell.png; await img.decode(); x.drawImage(img, cx, cy + lab, cellW, cellH); }
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
    gs.cameraDirector.update = () => {};
    window.__adv(1);
  });
}
async function stillPage(extra = '') {
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  page.on('pageerror', (e) => fail(`still: ${e.message}`));
  await page.goto(BASE + `?nodlg=1&nofreeze=1&roster=v1${extra}&${STILL}`);
  await stepBoot(page);
  await quietRoom(page);
  return page;
}

// ── SHEETS ────────────────────────────────────────────────────────────────
async function sheets(R) {
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  await page.goto(BASE + '?nodlg=1&roster=v1');
  await page.waitForFunction((k) => window.game?.textures?.exists(k), `${R.pre}-E`, { timeout: 45000 });
  for (const [key, file, title] of [
    [`${R.pre}-R`, `${R.file}-v1-sheet-regular.png`, `${R.name} REGULAR — ${R.pre}-R — 33 frames, 24x26 logical @4 (96x104), 1x`],
    [`${R.pre}-E`, `${R.file}-v1-sheet-elite.png`, `${R.name} ELITE — ${R.pre}-E — 33 frames, 24x26 logical @4 (96x104), 1x`],
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
      x.fillText('deck #212328 behind every frame. West = the SIDE block mirrored by flipX at runtime. Weapon is a separate overlay (see -weapon.png).', 10, H - 10);
      return c.toDataURL('image/png');
    }, { key, title });
    writeFileSync(OUT + file, Buffer.from(url.split(',')[1], 'base64'));
    console.log('wrote', OUT + file);
  }
  await page.close();
}

// ── FACINGS: Regular, Elite, legacy, unchanged Captain — S / N / E / W ─────
async function facings(R) {
  const page = await stillPage();
  const y = await page.evaluate((R) => {
    const gs = window.__gs, cam = gs.cameras.main;
    const X0 = 600, Y0 = 560, DX = 150, DY = 175;
    const P = gs.player; P.setPosition(X0 + 300, Y0 + 900); P.body.reset(P.x, P.y); P.setVisible(false); P.weaponSprite?.setVisible(false);
    cam.setScroll(X0 - 170, Y0 - 150);
    const dirs = [['FRONT (S)', Math.PI / 2], ['BACK (N)', -Math.PI / 2], ['SIDE (E)', 0], ['WEST (flip)', Math.PI]];
    const rows = [['REGULAR v1', {}], ['ELITE v1', { elite: true }], ['LEGACY', { legacyArt: true }], ['SHOCK CAPTAIN', null]];
    const lab = (x, y, t) => gs.add.text(x, y, t, { fontFamily: 'monospace', fontSize: '12px', color: '#e4e7ee', backgroundColor: '#0008' }).setOrigin(0.5).setDepth(9999);
    dirs.forEach(([name, aim], c) => {
      lab(X0 + c * DX, Y0 - 95, name);
      rows.forEach(([r, spec], ri) => {
        const x = X0 + c * DX, y = Y0 + ri * DY;
        let e;
        if (!spec) { e = gs.spawnChampion(x, y, 'captain'); window.__freeze(e, aim); const { dir } = e._facingSuffix(); e.play(`${e._animPrefix}-idle-${dir}`); }
        else { e = gs.spawnEnemyAt(R.type, x, y, spec); window.__freeze(e, aim); }
        e.body.reset(x, y);
        if (c === 0) lab(x - 74, y, r).setOrigin(1, 0.5);
      });
    });
    window.__adv(3); window.__quiet(); window.__adv(1);
    return cam.y;
  }, R);
  const buf = await page.screenshot({ clip: { x: 0, y, width: 720, height: 780 } });
  await compose(OUT + `${R.file}-v1-facings.png`, {
    title: `${R.name} v1 — Regular / Elite / legacy / unchanged Shock Captain — live runtime, 1x`,
    cols: 1, cellW: 720, cellH: 780,
    cells: [{ label: 'columns: aim S / N / E / W. Weapons placed by Enemy.preUpdate (frozen). Captain untouched.', png: b64(buf) }],
  });
  await page.close();
}

// ── WEAPON: pivot, gameplay spawn, the real bolt on its first drawn frame ──
async function weapon(R) {
  const page = await stillPage();
  const AIMS = [['E', 0], ['SE', Math.PI / 4], ['S', Math.PI / 2], ['W', Math.PI], ['N', -Math.PI / 2]];
  const TIERS = [['REGULAR', {}], ['ELITE', { elite: true }], ['LEGACY', { legacyArt: true }]];
  const cells = [], nums = [];
  for (const [tname, spec] of TIERS) for (const [aname, aim] of AIMS) {
    const r = await page.evaluate(({ spec, aim, type }) => {
      const gs = window.__gs, cam = gs.cameras.main;
      for (const e of gs.enemies.getChildren().slice()) gs._destroyEnemyFully(e);
      gs.enemyBullets.getChildren().forEach((b) => b.disableBody?.(true, true));
      window.__ann?.destroy();
      const X = 700, Y = 650;
      const P = gs.player; P.setPosition(X + Math.cos(aim) * 420, Y + Math.sin(aim) * 420); P.body.reset(P.x, P.y); P.setVisible(false); P.weaponSprite?.setVisible(false);
      const e = gs.spawnEnemyAt(type, X, Y, spec);
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
        pivot: along(ws), spawn: along(S), firstHead: along(b) + hb, muzzle: along(m), radius: e.cfg.radius };
    }, { spec, aim, type: R.type });
    const W = 300;
    const buf = await page.screenshot({ clip: { x: Math.round(r.scr.x - W / 2), y: Math.round(r.scr.y - W / 2), width: W, height: W } });
    cells.push({ label: `${tname} ${aname}`, png: b64(buf) });
    nums.push({ tier: tname, aim: aname, radius: r.radius, pivot: +r.pivot.toFixed(1), spawn: +r.spawn.toFixed(1), firstDrawnHead: +r.firstHead.toFixed(1), muzzle: +r.muzzle.toFixed(1) });
  }
  await page.evaluate(() => { window.__gs.cameras.main.setZoom(1); });
  await compose(OUT + `${R.file}-v1-weapon.png`, {
    title: `${R.name} v1 WEAPON — real overlay + a real bolt on its first rendered frame (2x camera zoom)`,
    cols: 5, cellW: 300, cellH: 300, cells,
    legend: [
      ['#40e0ff', 'weapon pivot — cfg.radius - 4 along the aim (Enemy.preUpdate, frozen)'],
      ['#ff40d0', 'GAMEPLAY SPAWN — cfg.radius + 4 (fireShooter, frozen, NOT moved)'],
      ['#ffe040', 'DRAWN MUZZLE — the outer edge of the weapon on the bolt axis'],
      ['#10ee10', 'the real bolt on its first rendered frame, under gun and body; tick = its leading edge'],
      ['#aab0bd', `muzzle = pivot + ${R.type === 'sniper' ? '73 (bolt 1000px/s)' : '48 (bolt 620px/s)'}: the bolt's first drawn leading edge. Legacy rows show the old shared rifle for reference.`],
    ],
  });
  writeFileSync(OUT + `${R.file}-v1-weapon-numbers.json`, JSON.stringify(nums, null, 1));
  console.table(nums);
  await page.close();
}

// ── COLLIDERS: ?colliders=1, legacy and v1, both tiers ────────────────────
async function colliders(R) {
  const page = await stillPage('&colliders=1');
  const r = await page.evaluate((type) => {
    const gs = window.__gs, cam = gs.cameras.main;
    const X0 = 520, Y0 = 600, DX = 150, DY = 150;
    const P = gs.player; P.setPosition(X0, Y0 + 700); P.body.reset(P.x, P.y); P.setVisible(false); P.weaponSprite?.setVisible(false);
    const who = [['LEGACY R', { legacyArt: true }, false], ['v1 R', {}, false], ['LEGACY E', { legacyArt: true }, true], ['v1 E', { elite: true }, false]];
    const out = [];
    who.forEach(([name, spec, legacyElite], i) => {
      for (const [row, aim] of [[0, Math.PI / 2], [1, 0]]) {
        const x = X0 + i * DX, y = Y0 + row * DY;
        const e = gs.spawnEnemyAt(type, x, y, spec);
        if (legacyElite) gs._makeElite(e, { legacyLook: true });
        window.__freeze(e, aim); e.body.reset(x, y);
        if (row === 0) gs.add.text(x, y - 70, name, { fontFamily: 'monospace', fontSize: '12px', color: '#e4e7ee', backgroundColor: '#000a' }).setOrigin(0.5).setDepth(9999);
        if (row === 0) out.push({ name, bodyW: e.body.width, radius: e.cfg.radius, scale: e.scaleX, tex: e.texture.key });
      }
    });
    cam.centerOn(X0 + 1.5 * DX, Y0 + DY / 2);
    window.__adv(3); window.__quiet(); window.__adv(1);
    const top = (Y0 - 95 - cam.worldView.y) + cam.y, bot = (Y0 + DY + 75 - cam.worldView.y) + cam.y;
    return { out, top, h: bot - top };
  }, R.type);
  console.table(r.out);
  const buf = await page.screenshot({ clip: { x: 0, y: Math.round(r.top), width: 720, height: Math.round(r.h) } });
  await compose(OUT + `${R.file}-v1-colliders.png`, {
    title: `${R.name} COLLIDERS — ?colliders=1, gameplay scale (1x). Top row aim S, bottom aim E`,
    cols: 1, cellW: 720, cellH: Math.round(r.h), cells: [{ label: 'v1 Elite renders at 1.0 on its dedicated sheet and keeps the HISTORICAL 84px body (legacy r30 x 1.4).', png: b64(buf) }],
    legend: [
      ['#40ff80', 'physics body: regular 44px wide; elite 84px wide in both legacy and v1 (unchanged)'],
      ['#ffe040', 'cfg.radius: what a bolt must touch — regular 22, elite 30, identical in legacy and v1'],
    ],
  });
  await page.close();
}

// ── a scripted player for the encounter videos (identical in every session) ─
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

async function live(q, file, FR = 600) {
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  page.on('pageerror', (e) => fail(`live: ${e.message}`));
  await page.goto(BASE + `?nodlg=1&nofreeze=1&roster=v1&${q}`);
  await stepBoot(page);
  await page.evaluate(PLAYER_SCRIPT);
  const vw = videoWriter(OUT + file);
  for (let f = 0; f < FR; f++) {
    await page.evaluate(() => window.__frame(2));
    await vw.write(await page.screenshot({ type: 'jpeg', quality: 90 }));
    if (f % 150 === 0) console.log(file, f, await page.evaluate(() => window.__gs.enemies.getChildren().filter((e) => e.active).map((e) => e.texture.key).join(',')));
  }
  await vw.end();
  console.log('wrote', OUT + file);
  await page.close();
}

async function ab(q, file, FR = 540) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1280 } });
  const base = `?nodlg=1&nofreeze=1&${q}`, qL = '', qR = '&roster=v1';
  await page.setContent(`<body style="margin:0;background:#000;display:flex;position:relative">
    <iframe src="${BASE}${base}${qL}" width="720" height="1280" style="border:0"></iframe>
    <iframe src="${BASE}${base}${qR}" width="720" height="1280" style="border:0"></iframe>
    <div style="position:absolute;left:0;top:1236px;width:720px;text-align:center;font:bold 22px monospace;color:#fff;background:#000a;padding:6px 0">LEGACY (default)</div>
    <div style="position:absolute;left:720px;top:1236px;width:720px;text-align:center;font:bold 22px monospace;color:#7dff9a;background:#000a;padding:6px 0">?roster=v1</div>
    <div style="position:absolute;left:718px;top:0;width:4px;height:1280px;background:#fff"></div></body>`);
  await page.waitForTimeout(1500);
  const fr = page.frames().slice(1);
  const [fL, fV] = [fr.find((f) => f.url().endsWith(base + qL)), fr.find((f) => f.url().endsWith(base + qR))];
  if (!fL || !fV) fail('ab: iframes not found');
  await stepBoot(fL); await stepBoot(fV);
  await fL.evaluate(PLAYER_SCRIPT); await fV.evaluate(PLAYER_SCRIPT);
  const vw = videoWriter(OUT + file);
  let same = 0, n = 0;
  for (let f = 0; f < FR; f++) {
    await fL.evaluate(() => window.__frame(2)); await fV.evaluate(() => window.__frame(2));
    await vw.write(await page.screenshot({ type: 'jpeg', quality: 88 }));
    if (f % 30 === 0) {
      const st = () => window.__gs.enemies.getChildren().filter((e) => e.active).map((e) => `${e.x.toFixed(2)},${e.y.toFixed(2)},${e.hp}`).join('|') + `#${window.__gs.player.x.toFixed(2)}`;
      n++; if (await fL.evaluate(st) === await fV.evaluate(st)) same++;
    }
  }
  await vw.end();
  console.log('wrote', OUT + file, `— the same fight (sampled state identical) at ${same}/${n} checkpoints`);
  await page.close();
}

// ── HIERARCHY: three roles x two tiers, plus the unchanged Captain, at 1x ───
async function hierarchy() {
  const page = await stillPage();
  const y = await page.evaluate(() => {
    const gs = window.__gs, cam = gs.cameras.main;
    const X0 = 380, Y0 = 600, DX = 92;
    const P = gs.player; P.setPosition(X0 + 300, Y0 + 900); P.body.reset(P.x, P.y); P.setVisible(false); P.weaponSprite?.setVisible(false);
    cam.setScroll(X0 - 60, Y0 - 230);
    const who = [['RIFLEMAN R', 'grunt', {}], ['RIFLEMAN E', 'grunt', { elite: true }], ['GUNNER R', 'shooter', {}], ['GUNNER E', 'shooter', { elite: true }],
      ['MARKSMAN R', 'sniper', {}], ['MARKSMAN E', 'sniper', { elite: true }]];
    const lab = (x, y, t) => gs.add.text(x, y, t, { fontFamily: 'monospace', fontSize: '11px', color: '#e4e7ee', backgroundColor: '#0008' }).setOrigin(0.5).setDepth(9999);
    who.forEach(([name, type, spec], i) => {
      const xx = X0 + i * DX, yy = Y0;
      const e = gs.spawnEnemyAt(type, xx, yy, spec); window.__freeze(e, Math.PI / 2 + 0.35); e.body.reset(xx, yy);
      lab(xx, yy - 72, name);
      const f = gs.spawnEnemyAt(type, xx, yy + 170, spec); window.__freeze(f, 0); f.body.reset(xx, yy + 170);
    });
    const c = gs.spawnChampion(X0 + 6 * DX + 34, Y0 + 80, 'captain');
    window.__freeze(c, Math.PI / 2); const { dir } = c._facingSuffix(); c.play(`${c._animPrefix}-idle-${dir}`); c.body.reset(c.x, c.y);
    lab(c.x, c.y - 92, 'SHOCK CAPTAIN');
    window.__adv(3); window.__quiet(); window.__adv(1);
    return cam.y + 110;                     // below the HUD's pause button
  });
  const buf = await page.screenshot({ clip: { x: 0, y, width: 720, height: 400 } });
  await compose(OUT + 'roster-v1-hierarchy-3roles.png', {
    title: 'ROSTER v1 HIERARCHY — 1x, live runtime: Rifleman / Gunner / Marksman (Regular, Elite) and the unchanged Shock Captain',
    cols: 1, cellW: 720, cellH: 400,
    cells: [{ label: 'top row aimed toward the camera, bottom row aimed east (weapon length in profile). Deck: Detention escort floor.', png: b64(buf) }],
  });
  await page.close();
}

const run = {
  rif: async () => { const R = ROLE.rif; await sheets(R); await facings(R); await weapon(R); await colliders(R);
    await live(ENC.rif, 'rifleman-v1-live-1x.webm'); await ab(ENC.rif, 'rifleman-v1-ab.webm'); },
  mrk: async () => { const R = ROLE.mrk; await sheets(R); await facings(R); await weapon(R); await colliders(R);
    await live(ENC.mrk, 'marksman-v1-live-1x.webm'); await ab(ENC.mrk, 'marksman-v1-ab.webm'); },
  videos: async () => {
    await live(ENC.rif, 'rifleman-v1-live-1x.webm'); await ab(ENC.rif, 'rifleman-v1-ab.webm');
    await live(ENC.mrk, 'marksman-v1-live-1x.webm'); await ab(ENC.mrk, 'marksman-v1-ab.webm');
    await run.both();
  },
  both: () => live('encdbg=sniperNest&room=hangar&sector=14&wave=1&move=v22', 'rifleman-marksman-v1-live.webm', 750),
  hier: hierarchy,
  stills: async () => { for (const R of Object.values(ROLE)) { await sheets(R); await facings(R); await weapon(R); await colliders(R); } await hierarchy(); },
};
if (MODE === 'all') { for (const k of ['rif', 'mrk', 'both', 'hier']) await run[k](); }
else if (run[MODE]) await run[MODE]();
else fail(`unknown mode ${MODE}`);
await browser.close();
