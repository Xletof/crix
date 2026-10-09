// EVIDENCE for the Demolisher Phase 2D CORRECTION (side-run anatomy + the
// false first stuck check). Writes docs/evidence/roster-demolisher-v1/correction/.
//
// Every frame is the live game, stepped deterministically (seeded Math.random,
// a 60Hz fixed step). OLD = a server on the rejected 785999f, NEW = this tree;
// an A/B runs the SAME script on both, in lockstep. Videos run 2 game ticks per
// 30fps video frame (1x real speed) unless they say slow motion.
//
// usage: DEM_OLD=http://localhost:5174/ node tests/shot-demolisher-correction.mjs [step ...]
//   stills: gaitab anatomy proof
//   videos: gaitlive gaitturn veer obstacle bomberrun mixed
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { veerRun } from './diag-demolisher-veer.mjs';

const ARGS = process.argv.slice(2);
const OUT = new URL('../docs/evidence/roster-demolisher-v1/correction/', import.meta.url).pathname;
const NEW = process.env.DEM_NEW || 'http://localhost:5173/';
const OLD = process.env.DEM_OLD || 'http://localhost:5174/';
const HX = { OLD: 11, NEW: 12 };   // the profile hip socket each build paints from
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const FFMPEG = '/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux';
const SEED = 4242;
const STILL = 'encdbg=1&room=hangar&sector=1';
const FLAGS = 'roster=v1&gait=v2&move=v22';
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
    window.__mod = async (re) => { const u = performance.getEntriesByType('resource').map((r) => r.name).find((n) => re.test(n)); return u ? import(u) : null; };
    window.__quiet = () => {
      const gs = window.__gs, hud = g.scene.getScene('HUD');
      gs.cameras.main.resetFX();
      gs._sectorTint?.setAlpha(0);
      if (hud) {
        hud.banner?.setAlpha(0);
        for (const o of hud.children.list) if (o.depth >= 47 && o.depth <= 49) o.setVisible(false);
      }
    };
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

const comp = await browser.newPage({ viewport: { width: 800, height: 600 } });
await comp.evaluate(() => {
  window.__img = async (s) => { const i = new Image(); i.src = s; await i.decode(); return i; };
  window.__comp = async (srcs, { W, H, draws, texts = [], bg = '#121418', type = 'jpeg' }) => {
    const imgs = await Promise.all(srcs.map(window.__img));
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    x.fillStyle = bg; x.fillRect(0, 0, W, H);
    for (const d of draws) {
      if (d.rect) { x.fillStyle = d.rect; x.fillRect(d.dx, d.dy, d.dw, d.dh); continue; }
      x.drawImage(imgs[d.i || 0], d.sx, d.sy, d.sw, d.sh, d.dx, d.dy, d.sw * (d.k || 1), d.sh * (d.k || 1));
    }
    for (const t of texts) { x.font = `${t.bold ? 'bold ' : ''}${t.size || 14}px monospace`; x.fillStyle = t.color || '#e4e7ee'; x.textAlign = t.align || 'left'; x.fillText(t.text, t.x, t.y); }
    return c.toDataURL(type === 'png' ? 'image/png' : 'image/jpeg', 0.92);
  };
});
async function composite(bufs, spec) {
  const url = await comp.evaluate(({ srcs, spec }) => window.__comp(srcs, spec), { srcs: bufs.map(b64), spec });
  return Buffer.from(url.split(',')[1], 'base64');
}
const save = (file, url) => { writeFileSync(OUT + file, Buffer.from(url.split(',')[1], 'base64')); console.log('wrote', OUT + file); };

async function quietRoom(page) {
  await page.evaluate(() => {
    const gs = window.__gs;
    gs.arenaActive = false; gs._roomModifier = null; gs.events.emit('set-darkness', false);
    if (gs.arenaCfg) gs.arenaCfg = { ...gs.arenaCfg, speedMult: undefined };
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
async function livePage(base, q, W = 720) {
  const page = await browser.newPage({ viewport: { width: W, height: 1280 } });
  page.on('pageerror', (e) => fail(`${base}: ${e.message}`));
  await page.goto(base + `?nodlg=1&nofreeze=1&${q}`);
  await stepBoot(page);
  return page;
}

// ── 1. SIDE GAIT A/B (sheet frames) ──────────────────────────────────────
const SIDE = [[16, 'idle'], [17, '1 contact'], [18, '2 load'], [19, '3 toe-off/reach'], [20, '4 contact'], [21, '5 load'], [22, '6 toe-off/reach'], [23, 'brace (detonation)']];
async function sheetSrc(base) {
  const page = await livePage(base, `${FLAGS}&${STILL}`);
  const r = await page.evaluate(async () => {
    const rp = await window.__mod(/systems\/rosterPaint\.js/);
    const o = { gait: rp.DEMO_GAIT.side };
    for (const k of ['ro-dem-R', 'ro-dem-E']) {
      const src = window.__gs.textures.get(k).getSourceImage();
      const c = document.createElement('canvas'); c.width = src.width; c.height = src.height; c.getContext('2d').drawImage(src, 0, 0);
      o[k] = c.toDataURL('image/png');
    }
    return o;
  });
  await page.close();
  return r;
}
async function gaitAB() {
  const O = await sheetSrc(OLD), N = await sheetSrc(NEW);
  const url = await comp.evaluate(async ({ O, N, SIDE }) => {
    const rows = [['785999f (REJECTED) — Regular', O['ro-dem-R']], ['CORRECTED — Regular', N['ro-dem-R']], ['785999f (REJECTED) — Elite', O['ro-dem-E']], ['CORRECTED — Elite', N['ro-dem-E']]];
    const imgs = await Promise.all(rows.map(([, s]) => window.__img(s)));
    const pad = 12, lab = 26, n = SIDE.length;
    const blk = (k) => ({ cw: 96 * k + pad, ch: 104 * k + lab });
    const b1 = blk(1), b3 = blk(3);
    const W = pad + 250 + n * b3.cw, H = 50 + rows.length * b1.ch + 44 + rows.length * b3.ch + 50;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    x.fillStyle = '#181a1f'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#e4e7ee'; x.font = 'bold 18px monospace';
    x.fillText('DEMOLISHER PROFILE RUN — 785999f (rejected on handset) vs CORRECTED · idle, the six run frames, the brace he detonates from', pad, 28);
    const block = (y0, k, title) => {
      x.fillStyle = '#ffd9a0'; x.font = 'bold 15px monospace'; x.fillText(title, pad, y0 - 8);
      rows.forEach(([name, ], r) => {
        const y = y0 + r * (104 * k + lab);
        x.fillStyle = r % 2 ? '#9fe0a8' : '#ff9a8a'; x.font = 'bold 13px monospace'; x.fillText(name, pad, y + 20);
        SIDE.forEach(([f, l], i) => {
          const dx = pad + 250 + i * (96 * k + pad);
          x.fillStyle = '#212328'; x.fillRect(dx, y + lab - 4, 96 * k, 104 * k);
          x.drawImage(imgs[r], f * 96, 0, 96, 104, dx, y + lab - 4, 96 * k, 104 * k);
          x.fillStyle = '#aab0bd'; x.font = '12px monospace'; x.fillText(k === 1 ? `f${f} ${l.split(' ')[0]}` : `f${f} ${l}`, dx, y + 14);
        });
      });
    };
    block(66, 1, '1x — gameplay scale, on the hangar deck value (the acceptance authority)');
    block(66 + rows.length * b1.ch + 44, 3, '3x — art inspection');
    x.fillStyle = '#d0d4dc'; x.font = '13px monospace';
    x.fillText('Corrected: hip socket under the torso (x12, was x11 — behind his centre), stride +4/0/-3 (was +5/-5), low swing passing under the pelvis, both boots toe-capped and pointing EAST.', pad, H - 30);
    x.fillText('Unchanged: every pixel above the pelvis (helmet, torso, canisters, rack, plate, heat layer) and every front/back frame — measured identical to 785999f by smoke-demolisher.', pad, H - 12);
    return c.toDataURL('image/png');
  }, { O, N, SIDE });
  save('demolisher-side-gait-ab.png', url);
}

// ── 2. ANATOMY OVERLAY ───────────────────────────────────────────────────
async function anatomy() {
  const O = await sheetSrc(OLD), N = await sheetSrc(NEW);
  const url = await comp.evaluate(async ({ O, N, SIDE, HX }) => {
    const Z = 8, fw = 24 * Z, fh = 26 * Z, gap = 14, lab = 34;
    const frames = SIDE.slice(0, 7);
    const rows = [['CORRECTED — EAST (as painted)', N, HX.NEW, false], ['CORRECTED — WEST (the same frame mirrored by the renderer)', N, HX.NEW, true], ['785999f (REJECTED) — EAST, for reference', O, HX.OLD, false]];
    const W = 20 + frames.length * (fw + gap), H = 60 + rows.length * (fh + lab + 26) + 90;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    x.fillStyle = '#181a1f'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#e4e7ee'; x.font = 'bold 18px monospace';
    x.fillText('DEMOLISHER PROFILE RUN — joints: hip · knee · ankle · toe   (Regular, 8x; the dots are drawn from the gait table the painter uses)', 10, 28);
    const ft = (st) => (st === 'S' ? 20 : (st === 'H' || st === 'L') ? 21 : 22);
    for (let r = 0; r < rows.length; r++) {
      const [name, src, hx, mirror] = rows[r];
      const img = await window.__img(src['ro-dem-R']);
      const y0 = 50 + r * (fh + lab + 26);
      x.fillStyle = r === 2 ? '#ff9a8a' : '#9fe0a8'; x.font = 'bold 14px monospace'; x.fillText(name, 10, y0 + 12);
      frames.forEach(([f, l], i) => {
        const X = 10 + i * (fw + gap), Y = y0 + lab;
        const sp = f === 16 ? src.gait.idle : src.gait.walk[f - 17];
        x.fillStyle = '#212328'; x.fillRect(X, Y, fw, fh);
        x.save();
        if (mirror) { x.translate(X + fw, Y); x.scale(-1, 1); x.drawImage(img, f * 96, 0, 96, 104, 0, 0, fw, fh); }
        else x.drawImage(img, f * 96, 0, 96, 104, X, Y, fw, fh);
        x.restore();
        const P = (px, py) => [X + (mirror ? (24 - (px + 1)) : (px + 1)) * Z, Y + (py + 0.5) * Z];
        const hip = 18 + sp.bob;
        for (const leg of ['F', 'N']) {
          const L = sp[leg], top = ft(L.st), kneeY = hip + Math.max(1, Math.floor((top - hip) / 2)) - (L.st === 'S' ? 1 : 0);
          const planted = L.st === 'F' || L.st === 'H';
          const col = planted ? '#39ff88' : '#ff4dff';
          const pts = [P(hx, hip), P(hx + L.k, kneeY), P(hx + L.f, top), P(hx + L.f + 3, L.st === 'H' ? top + 1 : top)];
          x.strokeStyle = col; x.lineWidth = 3; x.setLineDash(planted ? [] : [7, 5]);
          x.beginPath(); x.moveTo(...pts[0]); x.lineTo(...pts[1]); x.lineTo(...pts[2]); x.stroke();
          x.setLineDash([2, 3]); x.beginPath(); x.moveTo(...pts[2]); x.lineTo(...pts[3]); x.stroke(); x.setLineDash([]);
          pts.forEach(([px, py], j) => { x.fillStyle = j === 0 ? '#ffffff' : col; x.beginPath(); x.arc(px, py, j === 0 ? 6 : 4.5, 0, Math.PI * 2); x.fill(); x.strokeStyle = '#000'; x.lineWidth = 1.5; x.stroke(); });
        }
        x.fillStyle = '#aab0bd'; x.font = '12px monospace'; x.fillText(`f${f} ${l}`, X, Y - 6);
        const st = (L) => `${L.st}${L.f >= 0 ? '+' : ''}${L.f}`;
        x.fillStyle = '#d0d4dc'; x.fillText(`near ${st(sp.N)}  far ${st(sp.F)}`, X, Y + fh + 16);
      });
    }
    const ly = H - 70;
    x.font = '13px monospace';
    x.fillStyle = '#39ff88'; x.fillRect(10, ly - 10, 14, 4); x.fillStyle = '#d0d4dc'; x.fillText('PLANTED leg (F flat / H heel up, toe on the deck)  — solid', 32, ly - 4);
    x.fillStyle = '#ff4dff'; x.fillRect(10, ly + 10, 14, 4); x.fillStyle = '#d0d4dc'; x.fillText('SWINGING leg (L low swing / S high swing) — dashed', 32, ly + 16);
    x.fillStyle = '#ffffff'; x.beginPath(); x.arc(17, ly + 34, 6, 0, Math.PI * 2); x.fill(); x.fillStyle = '#d0d4dc'; x.fillText('the hip socket — ONE pelvis both legs hang from; dots: hip, knee, ankle, toe (the toe-cap is the east end of each boot)', 32, ly + 38);
    return c.toDataURL('image/png');
  }, { O, N, SIDE, HX });
  save('demolisher-side-anatomy.png', url);
}

// ── 5. FALSE-STUCK PROOF TABLE ───────────────────────────────────────────
async function proof() {
  const R = {};
  for (const [k, base, kase] of [['OLD', OLD, 'clear'], ['NEW', NEW, 'clear'], ['OLDW', OLD, 'wall'], ['NEWW', NEW, 'wall']]) {
    R[k] = await veerRun(browser, { base, flags: FLAGS, kase, elite: false, ticks: 240 });
  }
  const url = await comp.evaluate(async (R) => {
    const pick = (r, set) => r.rows.filter((x) => !x.dead && set(x.i));
    const sections = [
      ['CLEAR LANE — 785999f (REJECTED): a fresh Demolisher rushing a standing player 580px south, nothing in the way', pick(R.OLD, (i) => (i >= 30 && i <= 40) || (i > 40 && i <= 72 && i % 8 === 0)), '#ff9a8a'],
      ['CLEAR LANE — CORRECTED: the same spawn, the same seed', pick(R.NEW, (i) => (i >= 30 && i <= 40) || (i > 40 && i <= 72 && i % 8 === 0)), '#9fe0a8'],
      ['REAL OBSTRUCTION — CORRECTED: a 360x40 wall across the lane 140px out (stuck recovery must still fire)', pick(R.NEWW, (i) => (i >= 33 && i <= 37) || (i >= 69 && i <= 73) || (i > 73 && i % 20 === 0)), '#9fe0a8'],
    ];
    const cols = ['tick', 'ms', 'x', 'y', 'vx', 'vy', 'progress', 'off°', 'obstacle', 'stuck ref', 'timer', 'sidestep', 'branch', 'draws'];
    const cell = (x) => [x.i, x.ms, x.x.toFixed(1), x.y.toFixed(1), x.vx, x.vy, `${x.fromSpawn}px`, x.off ?? '-', x.blocked ? 'CONTACT' : '-', x.refX == null ? 'undefined' : `${x.refX.toFixed(0)},${x.refY.toFixed(0)}`, x.timer, x.side > 0 ? `ARMED ${x.side}ms` : '-', x.branch, x.draws];
    const widths = [50, 50, 64, 64, 50, 50, 84, 50, 84, 110, 54, 120, 80, 50];
    const W = Math.max(1720, 20 + widths.reduce((a, b) => a + b, 0)), rowH = 19;
    const H = 70 + sections.reduce((a, [, rows]) => a + 50 + (rows.length + 1) * rowH, 0) + 170;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = '#15171b'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#e4e7ee'; x.font = 'bold 17px monospace';
    x.fillText('THE FALSE FIRST STUCK CHECK — measured per tick, ?roster=v1 (legacy is identical), hangar sector 1, 300px/s', 10, 26);
    x.font = '13px monospace'; x.fillStyle = '#aab0bd';
    x.fillText('Enemy.preUpdate every 600ms: moved = hypot(x - (_stuckRefX ?? x), ...) — the reference starts UNDEFINED, so the first check always reads 0px moved.', 10, 48);
    let y = 76;
    for (const [title, rows, col] of sections) {
      x.fillStyle = col; x.font = 'bold 14px monospace'; x.fillText(title, 10, y); y += 22;
      let cx = 10; x.font = 'bold 12px monospace'; x.fillStyle = '#ffd9a0';
      cols.forEach((h, j) => { x.fillText(h, cx, y); cx += widths[j]; }); y += rowH;
      x.font = '12px monospace';
      for (const r of rows) {
        const hot = r.side > 0 || r.refX != null && r.timer === 0;
        if (r.side > 0) { x.fillStyle = '#4a1f1f'; x.fillRect(8, y - 14, W - 16, rowH); }
        else if (r.timer === 0 && r.refX != null) { x.fillStyle = '#1f3a28'; x.fillRect(8, y - 14, W - 16, rowH); }
        cx = 10; x.fillStyle = hot ? '#ffffff' : '#c8ccd4';
        cell(r).forEach((v, j) => { x.fillText(String(v), cx, y); cx += widths[j]; }); y += rowH;
      }
      y += 26;
    }
    const s = (r) => { const rows = r.rows.filter((q) => !q.dead); const f = rows.find((q) => q.side > 0); const st = rows.filter((q) => q.branch === 'SIDESTEP').length; return { f, st, det: r.rows.find((q) => q.dead)?.i }; };
    const so = s(R.OLD), sn = s(R.NEW), sow = s(R.OLDW), snw = s(R.NEWW);
    x.font = '13px monospace'; x.fillStyle = '#e4e7ee';
    const lines = [
      `CLEAR LANE  785999f: sidestep ARMED at ${so.f?.ms}ms, ${so.f?.fromSpawn}px from spawn, touching nothing -> ${so.st} ticks perpendicular (up to ${Math.max(...R.OLD.rows.filter((q) => q.branch === 'SIDESTEP').map((q) => q.off))}deg off the bearing); contact at tick ${so.det ?? '-'}`,
      `CLEAR LANE  CORRECTED: the same check runs at 600ms (timer resets, the reference is set, its random draw is still made) — no sidestep; contact at tick ${sn.det ?? '-'}`,
      `OBSTRUCTION 785999f: sidestep armed at ${sow.f?.ms}ms (the false first check, which happened to land on the wall); detonated at tick ${sow.det ?? '-'}`,
      `OBSTRUCTION CORRECTED: the first check is stood down (it moved ${R.NEWW.rows[35]?.fromSpawn}px in its window); pinned on the wall, the base's NEXT check arms the sidestep at ${snw.f?.ms}ms -> ${snw.st} ticks; detonated on the player at tick ${snw.det ?? '-'}`,
      'Green rows: a stuck check ran (timer reset, reference set). Red rows: a sidestep is armed. Same speed, contact distance and blast; the first check still makes its one random draw.',
    ];
    let ly = H - 140; for (const l of lines) { x.fillText(l, 10, ly); ly += 24; }
    return c.toDataURL('image/png');
  }, R);
  save('demolisher-false-stuck-proof.png', url);
}

// ── VIDEO: two builds in lockstep ────────────────────────────────────────
// `stage(page, cfg)` installs window.__frame(per) in a page; `pair` steps OLD
// and NEW together, screenshots a world band from each and stacks/abuts them.
async function pair(file, script, cfg, { FR, per = 2, band, layout = 'stack', inset = null, label, slowFrom = null, slowTo = null, slowRepeat = 2 }) {
  const pages = [await livePage(OLD, `${FLAGS}&${STILL}`), await livePage(NEW, `${FLAGS}&${STILL}`)];
  for (const p of pages) { await quietRoom(p); await p.evaluate(script, cfg); }
  const vw = videoWriter(OUT + file);
  const shoot = async (p) => {
    const st = await p.evaluate((per) => window.__frame(per), per);
    const clip = { x: band.x, y: 84 + band.y, width: band.w, height: band.h };
    return { st, buf: await p.screenshot({ clip }) };
  };
  const frames = [];
  for (let f = 0; f < FR; f++) {
    const [a, b] = [await shoot(pages[0]), await shoot(pages[1])];
    const k = inset?.k || 3, iw = inset ? inset.w * k : 0, ih = inset ? inset.h * k : 0;
    let W, H, draws = [], texts = [];
    const lab = 24;
    if (layout === 'stack') {
      W = band.w + (inset ? iw + 8 : 0); H = 2 * (band.h + lab) + 34;
      [a, b].forEach((s, j) => {
        const y = j * (band.h + lab) + lab;
        draws.push({ i: j, sx: 0, sy: 0, sw: band.w, sh: band.h, dx: 0, dy: y });
        if (inset && s.st.ix != null) draws.push({ rect: '#212328', dx: band.w + 8, dy: y, dw: iw, dh: Math.min(ih, band.h) }, { i: j, sx: Math.max(0, Math.round(s.st.ix - band.x - inset.w / 2)), sy: Math.max(0, Math.round(s.st.iy - band.y - inset.h / 2)), sw: inset.w, sh: Math.min(inset.h, Math.floor(band.h / k)), dx: band.w + 8, dy: y, k });
        texts.push({ text: `${j ? 'CORRECTED' : '785999f (REJECTED)'} — ${s.st.s}`, x: 8, y: y - 7, size: 13, bold: true, color: j ? '#9fe0a8' : '#ff9a8a' });
      });
    } else {
      W = 2 * band.w + 10; H = band.h + lab + 34;
      [a, b].forEach((s, j) => {
        draws.push({ i: j, sx: 0, sy: 0, sw: band.w, sh: band.h, dx: j * (band.w + 10), dy: lab });
        texts.push({ text: `${j ? 'CORRECTED' : '785999f (REJECTED)'}`, x: j * (band.w + 10) + 8, y: 17, size: 14, bold: true, color: j ? '#9fe0a8' : '#ff9a8a' });
        texts.push({ text: s.st.s, x: j * (band.w + 10) + 8, y: band.h + lab + 14, size: 12, color: j ? '#9fe0a8' : '#ff9a8a' });
      });
      draws.push({ rect: '#000', dx: band.w, dy: 0, dw: 10, dh: H });
    }
    texts.push({ text: label(a.st, f), x: 8, y: H - 10, size: 13, color: '#ffd9a0' });
    const jpg = await composite([a.buf, b.buf], { W, H, draws, texts });
    await vw.write(jpg);
    frames.push({ jpg, st: [a.st, b.st] });
  }
  // a slow-motion repeat of a window, from the frames already captured
  if (slowFrom != null) {
    for (let f = slowFrom; f < slowTo; f++) {
      for (let r = 0; r < slowRepeat; r++) await vw.write(frames[f].jpg);
    }
  }
  await vw.end();
  console.log('wrote', OUT + file);
  for (const p of pages) await p.close();
  return frames.map((x) => x.st);
}

// The gait clips SEED the stuck reference at spawn, in both halves: the
// base's first check then measures the real window, so a gait comparison is
// not interrupted by the old build's veer (clip 6 is the veer).

// ── 3. LIVE HORIZONTAL CHASE ─────────────────────────────────────────────
async function gaitLive() {
  // an east pass, then a fresh west pass: the player runs at 330px/s (just
  // faster than him), Regular and Elite chase in profile
  const cfg = { legs: [[0, 200, true, [520, 700], [330, 0]], [200, 400, true, [1080, 700], [-330, 0]]] };
  await pair('demolisher-side-gait-live.webm', (cfg) => {
    const gs = window.__gs, P = gs.player, runners = [];
    window.game.scene.getScene('HUD')?.scene.setVisible(false);
    const SP = [[{ x: 170, y: 640, label: 'Regular' }, { x: 110, y: 770, elite: true, label: 'Elite' }], [{ x: 1430, y: 640, label: 'Regular' }, { x: 1490, y: 770, elite: true, label: 'Elite' }]];
    window.__tick = 0; let leg = -1;
    window.__frame = (per) => {
      for (let k = 0; k < per; k++) {
        const i = window.__tick++, L = cfg.legs.findIndex(([a, b]) => i >= a && i < b), [a, , , p0, v] = cfg.legs[Math.max(0, L)];
        if (L !== leg) {
          leg = L;
          for (const e of runners.splice(0)) if (e.active) gs._destroyEnemyFully(e);
          for (const s of SP[L] || []) { const e = gs.spawnEnemyAt('bomber', s.x, s.y, s.elite ? { elite: true } : {}); e._stuckRefX = e.x; e._stuckRefY = e.y; e.__label = s.label; runners.push(e); }
        }
        P.setPosition(p0[0] + v[0] * (i - a) / 60, p0[1] + v[1] * (i - a) / 60); P.body.reset(P.x, P.y);
        window.__adv(1);
      }
      window.__quiet();
      const R = runners[0], cam = gs.cameras.main;
      cam.setScroll(Math.max(0, Math.min(1600 - 720, R.x - 360)), 400);
      const f = (b) => `${b.__label} ${(b.anims.currentAnim?.key || '').replace(/^ro-dem-[RE]-/, '')} ${b.flipX ? 'WEST' : 'EAST'} f${b.frame.name} ${Math.round(Math.hypot(b.body.velocity.x, b.body.velocity.y))}px/s`;
      return { s: runners.map(f).join('   '), ix: R.x - cam.scrollX, iy: R.y - cam.scrollY };
    };
  }, cfg, { FR: 200, band: { x: 0, y: 160, w: 720, h: 330 }, inset: { w: 100, h: 110, k: 3 }, label: (st, f) => `1x real speed — horizontal chase, east pass then west pass (player 330px/s, Regular 300, Elite 270).  Right: the Regular at 3x.  t ${(f * 2 / 60).toFixed(1)}s` });
}

// ── 4. LATERAL MOVEMENT + FACING TRANSITIONS ─────────────────────────────
async function gaitTurn() {
  // one lap with the Regular, then one with the Elite: the player loops a wide
  // flat ellipse at ~360px/s (always just ahead of a 300px/s runner), so most
  // of the run is lateral and each end of the loop is a facing transition
  const cfg = { ellipse: { cx: 800, cy: 700, rx: 460, ry: 170, period: 360 } };
  await pair('demolisher-side-gait-turn.webm', (cfg) => {
    const gs = window.__gs, P = gs.player, E = cfg.ellipse;
    window.game.scene.getScene('HUD')?.scene.setVisible(false);
    let R = null;
    const lap = (elite) => {
      if (R?.active) gs._destroyEnemyFully(R);
      R = gs.spawnEnemyAt('bomber', E.cx - 120, E.cy, elite ? { elite: true } : {});
      R._stuckRefX = R.x; R._stuckRefY = R.y; R.__label = elite ? 'Elite' : 'Regular';
    };
    window.__tick = 0;
    window.__frame = (per) => {
      for (let k = 0; k < per; k++) {
        const i = window.__tick++, t = (i % E.period) / E.period * Math.PI * 2;
        if (i % E.period === 0) lap(i >= E.period);
        P.setPosition(E.cx + Math.cos(t) * E.rx, E.cy + Math.sin(t) * E.ry); P.body.reset(P.x, P.y);
        // staging guard (both halves): a runner that catches the player is put back across the loop
        if (R.alive && Math.hypot(P.x - R.x, P.y - R.y) < 110) { R.setPosition(E.cx - (P.x - E.cx) * 0.6, E.cy - (P.y - E.cy) * 0.6); R.body.reset(R.x, R.y); }
        window.__adv(1);
      }
      window.__quiet();
      const cam = gs.cameras.main; cam.setScroll(Math.max(0, Math.min(1600 - 720, R.x - 360)), 700 - 230);
      const key = R.anims.currentAnim?.key || '';
      return { s: `${R.__label} ${key.replace(/^ro-dem-[RE]-/, '')}${key.endsWith('side') ? (R.flipX ? ' WEST' : ' EAST') : ''} f${R.frame.name} ${Math.round(Math.hypot(R.body.velocity.x, R.body.velocity.y))}px/s`, ix: R.x - cam.scrollX, iy: R.y - cam.scrollY };
    };
  }, cfg, { FR: 360, band: { x: 0, y: 0, w: 720, h: 470 }, inset: { w: 100, h: 110, k: 3 }, label: (st, f) => `1x real speed — the player loops a wide flat ellipse: lateral runs and the turns at each end; a Regular lap, then an Elite lap (3x inset).  t ${(f * 2 / 60).toFixed(1)}s` });
}

// ── 6. THE VEER, A/B ─────────────────────────────────────────────────────
// Same seed, same room, same staging, both builds in lockstep: a Regular and
// an Elite spawn 580px north of a standing player in an empty lane. Dashed:
// the straight line to the player. Solid: the path actually run.
const RUSHTRACE = (cfg) => {
  const gs = window.__gs, P = gs.player;
  window.game.scene.getScene('HUD')?.scene.setVisible(false);
  P.setPosition(cfg.px, cfg.py); P.body.reset(P.x, P.y);
  gs.cameras.main.setScroll(cfg.cam[0], cfg.cam[1]);
  if (cfg.wall) { const w = gs.add.rectangle(cfg.wall[0], cfg.wall[1], cfg.wall[2], cfg.wall[3], 0x6a4a3a, 1).setDepth(5).setStrokeStyle(2, 0xb08a70); gs.physics.add.existing(w, true); gs.walls.add(w); }
  const g = gs.add.graphics().setDepth(8000);
  const B = [];
  window.__tick = 0;
  const born = (s) => {
    const e = gs.spawnEnemyAt('bomber', s.x, s.y, s.elite ? { elite: true } : {});
    B.push({ e, s, trail: [[s.x, s.y]], first: null, armedAt: [], label: s.label });
  };
  window.__frame = (per) => {
    for (let k = 0; k < per; k++) {
      const i = window.__tick++;
      for (const s of cfg.spawns) if (s.at === i) born(s);
      window.__adv(1);
      for (const b of B) {
        const e = b.e; if (!e.active || !e.alive) continue;
        b.trail.push([e.x, e.y]);
        if (b.first == null && e._stuckRefX !== undefined) b.first = { i: i - b.s.at, moved: Math.hypot(e.x - b.s.x, e.y - b.s.y) };
        if (e._stuckSidestepMs > 0 && (b.armedAt.length === 0 || b.armedAt.at(-1).end)) b.armedAt.push({ i: i - b.s.at, x: e.x, y: e.y });
        if (!(e._stuckSidestepMs > 0) && b.armedAt.length && !b.armedAt.at(-1).end) b.armedAt.at(-1).end = i - b.s.at;
      }
    }
    window.__quiet();
    g.clear();
    for (const b of B) {
      const col = b.s.elite ? 0xffc04a : 0x9fd8ff;
      g.lineStyle(2, 0xffffff, 0.35);
      const [sx, sy] = [b.s.x, b.s.y], L = Math.hypot(P.x - sx, P.y - sy);
      for (let d = 0; d < L; d += 22) { const a = d / L, c2 = Math.min(1, (d + 11) / L); g.lineBetween(sx + (P.x - sx) * a, sy + (P.y - sy) * a, sx + (P.x - sx) * c2, sy + (P.y - sy) * c2); }
      g.lineStyle(3, col, 0.95); g.beginPath(); g.moveTo(b.trail[0][0], b.trail[0][1]); for (const [x, y] of b.trail) g.lineTo(x, y); g.strokePath();
      for (const a of b.armedAt) { g.lineStyle(3, 0xff3030, 1); g.strokeCircle(a.x, a.y, 16); }
    }
    const fmt = (b) => {
      const e = b.e, t = ((window.__tick - b.s.at) / 60).toFixed(2);
      if (!e.alive) return `${b.label}: DETONATED`;
      const side = e._stuckSidestepMs > 0 ? `SIDESTEP ${Math.round(e._stuckSidestepMs)}ms` : 'toward the player';
      return `${b.label} t${t}s ${side}`;
    };
    return { s: B.map(fmt).join('  ·  '), B: B.map((b) => ({ first: b.first, armed: b.armedAt.map((a) => [a.i, a.end ?? null]), alive: b.e.alive })) };
  };
};
async function veer() {
  const cfg = { px: 820, py: 1000, cam: [460, 120], spawns: [{ at: 20, x: 740, y: 420, label: 'Regular' }, { at: 20, x: 900, y: 420, elite: true, label: 'Elite' }] };
  const st = await pair('demolisher-veer-ab.webm', RUSHTRACE, cfg, {
    FR: 110, band: { x: 80, y: 250, w: 560, h: 700 }, layout: 'abut',
    label: (s, f) => `1x real speed — same seed, room, staging; the stuck check runs 0.60s after spawning.  Dashed: straight line to the player.  Red ring: sidestep armed.  t ${((f * 2 - 20) / 60).toFixed(2)}s`,
    slowFrom: 30, slowTo: 60, slowRepeat: 4,
  });
  console.log('veer', JSON.stringify(st.at(-1)));
}
async function obstacle() {
  const cfg = { px: 820, py: 1000, cam: [460, 120], wall: [820, 560, 360, 40], spawns: [{ at: 20, x: 820, y: 420, label: 'Regular' }] };
  const st = await pair('demolisher-obstacle-recovery.webm', RUSHTRACE, cfg, {
    FR: 150, band: { x: 80, y: 250, w: 560, h: 700 }, layout: 'abut',
    label: (s, f) => `1x — a REAL obstruction: stuck recovery must still fire. Red ring: sidestep armed.  t ${((f * 2 - 20) / 60).toFixed(2)}s after spawn`,
  });
  console.log('obstacle', JSON.stringify(st.at(-1)));
}

// ── 8-9. REAL ENCOUNTERS (corrected build) ───────────────────────────────
const FIGHT = (seg) => {
  const gs = window.__gs, P = gs.player;
  window.__tick = 0;
  window.__frame = (per) => {
    for (let k = 0; k < per; k++) {
      const i = window.__tick++, cur = seg.find(([a, b]) => i >= a && i < b)[2], K = gs.keys;
      K.A.isDown = cur.includes('A'); K.D.isDown = cur.includes('D'); K.W.isDown = cur.includes('W'); K.S.isDown = cur.includes('S');
      if (i >= 60 && i % 7 === 0) P.keyboardFire();
      if (i === 700) { P.superCharge = 999; P.tryFireSuper(P._autoAimAngle()); }
      window.__adv(1);
    }
    window.__quiet();
    const c = {};
    for (const e of gs.enemies.getChildren()) if (e.active && e.alive) c[e.texture.key] = (c[e.texture.key] || 0) + 1;
    return `${Object.entries(c).map(([k, v]) => `${k}x${v}`).join(' ')}   first checks stood down ${window.__veto.n}, real sidesteps ${window.__veto.legit}`;
  };
};
const SEG = [[0, 160, ''], [160, 260, 'A'], [260, 380, 'W'], [380, 480, 'D'], [480, 600, 'S'], [600, 700, ''], [700, 820, 'A'], [820, 940, 'D'], [940, 99999, '']];
async function encounter(q, file, FR, title) {
  const page = await livePage(NEW, q);
  await page.evaluate(async () => {
    const EB = (await window.__mod(/entities\/Enemy\.js/)).EnemyBomber, v = (window.__veto = { n: 0, legit: 0 });
    const veto = EB.prototype._vetoFalseStuck;
    EB.prototype._vetoFalseStuck = function () {
      const first = !this._stuckFirstSeen && !this._miniBoss && this._stuckRefX !== undefined, armed = this._stuckSidestepMs > 0;
      veto.call(this);
      if (first && armed && !(this._stuckSidestepMs > 0)) v.n++;
      if (!this._miniBoss && this._stuckSidestepMs >= 590) v.legit++;
    };
  });
  await page.evaluate(FIGHT, SEG);
  const vw = videoWriter(OUT + file);
  for (let f = 0; f < FR; f++) {
    const st = await page.evaluate(() => window.__frame(2));
    const buf = await page.screenshot({ clip: { x: 0, y: 84, width: 720, height: 960 } });
    await vw.write(await composite([buf], { W: 720, H: 996, draws: [{ sx: 0, sy: 0, sw: 720, sh: 960, dx: 0, dy: 0 }], texts: [{ text: `${title} 1x — ${st}   t ${(f * 2 / 60).toFixed(1)}s`, x: 8, y: 984, size: 12, color: '#ffd9a0' }] }));
  }
  await vw.end();
  console.log('wrote', OUT + file, await page.evaluate(() => JSON.stringify(window.__veto)));
  await page.close();
}

const steps = {
  gaitab: gaitAB, anatomy, proof, gaitlive: gaitLive, gaitturn: gaitTurn, veer, obstacle,
  bomberrun: () => encounter(`${FLAGS}&encdbg=bomberRun&room=hangar&sector=8&wave=2`, 'demolisher-correction-bomber-run.webm', 560, 'BOMBER RUN (hangar, sector 8, wave 2)'),
  mixed: () => encounter(`${FLAGS}&encdbg=mixed&room=detention&sector=12&wave=1`, 'demolisher-correction-mixed.webm', 560, 'MIXED ASSAULT (detention, sector 12)'),
};
const todo = ARGS.length ? ARGS : Object.keys(steps);
for (const s of todo) { if (!steps[s]) fail(`unknown step ${s}`); console.log('──', s); await steps[s](); }
await browser.close();
