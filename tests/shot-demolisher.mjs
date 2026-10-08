// EVIDENCE for the Demolisher production slice (`bomber`, roster v1).
// Writes docs/evidence/roster-demolisher-v1/. Every frame is the live game,
// stepped deterministically (seeded Math.random, a 60Hz fixed step), at 1x
// unless a cell says otherwise; videos run 2 game ticks per 30fps video frame
// (real speed) unless they say slow motion.
//
// usage: node tests/shot-demolisher.mjs [step ...]   (no step = all)
//   stills: sheets facings colliders warnstrip hier
//   videos: gait warnlive warnab contact death bomberrun mixed nemesis
//   perf
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const ARGS = process.argv.slice(2);
const OUT = new URL('../docs/evidence/roster-demolisher-v1/', import.meta.url).pathname;
const BASE = 'http://localhost:5173/';
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
    // a held pose: the AI yields while `_performing`, the facing is `_aim`
    window.__freeze = (e, aim) => { e._performing = true; e._movePlanted = true; e._aim = aim; e.setVelocity?.(0, 0); };
    window.__lab = (x, y, t, o = 0.5, col = '#e4e7ee') => window.__gs.add.text(x, y, t, { fontFamily: 'monospace', fontSize: '12px', color: col, backgroundColor: '#000a' }).setOrigin(o, 0.5).setDepth(9999);
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
  window.__comp = async (srcs, { W, H, draws, texts = [], bg = '#121418', type = 'jpeg' }) => {
    const imgs = await Promise.all(srcs.map(async (s) => { const i = new Image(); i.src = s; await i.decode(); return i; }));
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
async function compose(file, { title, cols, cellW, cellH, cells, legend = [], bg = '#181a1f' }) {
  const url = await comp.evaluate(async ({ title, cols, cellW, cellH, cells, legend, bg }) => {
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
      if (cell.png) { const img = new Image(); img.src = cell.png; await img.decode(); x.drawImage(img, cx, cy + lab, cell.w || cellW, cell.h || cellH); }
    }
    let ly = H - legH - pad + 14;
    x.font = '12px monospace';
    for (const [col, text] of legend) { x.fillStyle = col; x.fillRect(pad, ly - 9, 10, 10); x.fillStyle = '#d0d4dc'; x.fillText(text, pad + 16, ly); ly += 18; }
    return c.toDataURL('image/png');
  }, { title, cols, cellW, cellH, cells, legend, bg });
  writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
  console.log('wrote', file);
}

async function quietRoom(page) {
  await page.evaluate(() => {
    const gs = window.__gs;
    gs.arenaActive = false; gs._roomModifier = null; gs.events.emit('set-darkness', false);
    // staged rigs run at the base speed: a rolled FRENZY would carry its speedMult into every spawn
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
async function stillPage(flags = FLAGS, extra = '', W = 720) {
  const page = await browser.newPage({ viewport: { width: W, height: 1280 } });
  page.on('pageerror', (e) => fail(`still: ${e.message}`));
  await page.goto(BASE + `?nodlg=1&nofreeze=1&${flags}${extra}&${STILL}`);
  await stepBoot(page);
  await quietRoom(page);
  return page;
}

// ── 1-2. SHEETS ──────────────────────────────────────────────────────────
async function sheets() {
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  await page.goto(BASE + `?nodlg=1&${FLAGS}`);
  await page.waitForFunction(() => window.game?.textures?.exists('ro-dem-E-heat'), null, { timeout: 45000 });
  for (const [key, file, name] of [['ro-dem-R', 'demolisher-v1-sheet-regular.png', 'DEMOLISHER REGULAR'], ['ro-dem-E', 'demolisher-v1-sheet-elite.png', 'DEMOLISHER ELITE']]) {
    const url = await page.evaluate(({ key, name }) => {
      const src = window.game.textures.get(key).getSourceImage(), heat = window.game.textures.get(`${key}-heat`).getSourceImage();
      const fw = 96, fh = 104, gap = 10, labH = 16, left = 92, top = 40;
      const rows = [
        ['FRONT', 0, ['0 idle', '1 run', '2 run', '3 run', '4 run', '5 run', '6 run', '7 brace']],
        ['BACK', 8, ['8 idle', '9 run', '10 run', '11 run', '12 run', '13 run', '14 run', '15 brace']],
        ['SIDE (E)', 16, ['16 idle', '17 run', '18 run', '19 run', '20 run', '21 run', '22 run', '23 brace']],
        ['POSES', 24, ['24 F raise', '25 F thrust', '26 F recoil', '27 B raise', '28 B thrust', '29 B recoil', '30 S raise', '31 S thrust', '32 S recoil']],
        ['STRAFE F', 33, ['33', '34', '35', '36', '37', '38']],
        ['STRAFE B', 39, ['39', '40', '41', '42', '43', '44']],
        ['STRAFE S', 45, ['45', '46', '47', '48', '49', '50']],
        ['HEAT (ADD)', 0, ['0 front', '8 back', '16 side', '1 run', '9 run', '17 run'], [0, 8, 16, 1, 9, 17]],
        ['IMMINENT', 0, ['0 front', '8 back', '16 side', '1 run', '9 run', '17 run'], [0, 8, 16, 1, 9, 17]],
      ];
      const W = left + 9 * (fw + gap) + gap, H = top + rows.length * (fh + labH + gap) + 44;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
      x.fillStyle = '#212328'; x.fillRect(0, 0, W, H);
      x.fillStyle = '#e4e7ee'; x.font = 'bold 14px monospace'; x.fillText(`${name} — ${key} — 51 frames (?gait=v2: 33 stock + 18 strafe), 24x26 logical @4 (96x104), 1x`, 10, 24);
      rows.forEach(([rn, base, labels, idx], ri) => {
        const y0 = top + ri * (fh + labH + gap);
        x.fillStyle = '#c8ccd6'; x.font = 'bold 12px monospace'; x.fillText(rn, 8, y0 + labH + fh / 2);
        labels.forEach((l, i) => {
          const x0 = left + i * (fw + gap), f = idx ? idx[i] : base + i;
          x.fillStyle = '#8a8f9c'; x.font = '11px monospace'; x.fillText(l, x0, y0 + 12);
          if (rn.startsWith('HEAT')) { x.fillStyle = '#000'; x.fillRect(x0, y0 + labH, fw, fh); x.drawImage(heat, f * fw, 0, fw, fh, x0, y0 + labH, fw, fh); }
          else if (rn === 'IMMINENT') {
            x.drawImage(src, f * fw, 0, fw, fh, x0, y0 + labH, fw, fh);
            x.globalCompositeOperation = 'lighter'; x.globalAlpha = 0.92; x.drawImage(heat, f * fw, 0, fw, fh, x0, y0 + labH, fw, fh);
            x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
          } else x.drawImage(src, f * fw, 0, fw, fh, x0, y0 + labH, fw, fh);
        });
      });
      x.fillStyle = '#8a8f9c'; x.font = '11px monospace';
      x.fillText('deck #212328. West = SIDE mirrored by flipX. No weapon overlay. HEAT is the same-layout payload layer, DERIVED from each frame (payload pixels + their rim);', 10, H - 26);
      x.fillText('IMMINENT = body + heat composited ADD at the warning law\'s near-contact peak (the lamps are drawn at runtime, not shown here).', 10, H - 10);
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
  const y = await page.evaluate(() => {
    const gs = window.__gs, cam = gs.cameras.main;
    window.game.scene.getScene('HUD')?.scene.setVisible(false);
    const X0 = 620, Y0 = 560, DX = 140, DY = 150;
    const P = gs.player; P.setPosition(X0 + 300, Y0 + 1100); P.body.reset(P.x, P.y); P.setVisible(false); P.weaponSprite?.setVisible(false);
    cam.setScroll(X0 - 190, Y0 - 140);
    const dirs = [['FRONT (S)', Math.PI / 2], ['BACK (N)', -Math.PI / 2], ['SIDE (E)', 0], ['WEST (flip)', Math.PI]];
    const rows = [['REGULAR v1', {}], ['ELITE v1', { elite: true }], ['LEGACY', { legacyArt: true }], ['RIFLEMAN v1', 'grunt'], ['SHOCK CAPTAIN', null]];
    dirs.forEach(([name, aim], c) => {
      window.__lab(X0 + c * DX, Y0 - 90, name);
      rows.forEach(([r, spec], ri) => {
        const x = X0 + c * DX, yy = Y0 + ri * DY;
        let e;
        if (!spec) { e = gs.spawnChampion(x, yy, 'captain'); window.__freeze(e, aim); const { dir } = e._facingSuffix(); e.play(`${e._animPrefix}-idle-${dir}`); }
        else if (spec === 'grunt') { e = gs.spawnEnemyAt('grunt', x, yy, {}); window.__freeze(e, aim); }
        else { e = gs.spawnEnemyAt('bomber', x, yy, spec); window.__freeze(e, aim); }
        e.body.reset(x, yy);
        if (c === 0) window.__lab(x - 64, yy, r, 1);
      });
    });
    window.__adv(3); window.__quiet(); window.__adv(1);
    return cam.y;
  });
  const buf = await page.screenshot({ clip: { x: 0, y, width: 720, height: 780 } });
  await compose(OUT + 'demolisher-v1-facings.png', {
    title: 'DEMOLISHER v1 — Regular / Elite / legacy, beside the v1 Rifleman and the unchanged Shock Captain — live runtime, 1x',
    cols: 1, cellW: 720, cellH: 780,
    cells: [{ label: 'columns: facing S / N / E / W (west = the east block mirrored). Resting, armed at range: indicator + canister lights steady, payload cold.', png: b64(buf) }],
  });
  await page.close();
}

// ── 4. COLLIDERS ─────────────────────────────────────────────────────────
async function colliders() {
  const page = await stillPage(FLAGS, '&colliders=1');
  const r = await page.evaluate(() => {
    const gs = window.__gs, cam = gs.cameras.main;
    const X0 = 470, Y0 = 600, DX = 125, DY = 150;
    const P = gs.player; P.setPosition(X0, Y0 + 900); P.body.reset(P.x, P.y); P.setVisible(false); P.weaponSprite?.setVisible(false);
    const who = [['LEGACY R', { legacyArt: true }, false], ['v1 R', {}, false], ['LEGACY E', { legacyArt: true }, true], ['v1 E', { elite: true }, false], ['NEMESIS', null, false]];
    const out = [];
    who.forEach(([name, spec, legacyElite], i) => {
      for (const [row, aim] of [[0, Math.PI / 2], [1, 0]]) {
        const x = X0 + i * DX, y = Y0 + row * DY;
        let e;
        if (!spec) { e = gs.spawnEnemyAt('bomber', x, y, { legacyArt: true }); gs._wearNemesisBody(e, { base: 'bomber' }); gs._makeElite(e, { legacyLook: true, scale: 1.8 * 1.0, hpMult: 6 }); }
        else { e = gs.spawnEnemyAt('bomber', x, y, spec); if (legacyElite) gs._makeElite(e, { legacyLook: true }); }
        window.__freeze(e, aim); e.body.reset(x, y);
        if (row === 0) window.__lab(x, y - 78, name);
        if (row === 0) out.push({ name, bodyW: +e.body.width.toFixed(2), radius: e.cfg.radius, scale: +e.scaleX.toFixed(2), tex: e.texture.key });
      }
    });
    cam.centerOn(X0 + 2 * DX, Y0 + DY / 2);
    window.__adv(3); window.__quiet(); window.__adv(1);
    const top = (Y0 - 100 - cam.worldView.y) + cam.y, bot = (Y0 + DY + 80 - cam.worldView.y) + cam.y;
    return { out, top, h: bot - top };
  });
  console.table(r.out);
  const buf = await page.screenshot({ clip: { x: 0, y: Math.round(r.top), width: 720, height: Math.round(r.h) } });
  await compose(OUT + 'demolisher-v1-colliders.png', {
    title: 'DEMOLISHER COLLIDERS — ?colliders=1, gameplay scale (1x). Top row facing S, bottom facing E',
    cols: 1, cellW: 720, cellH: Math.round(r.h),
    cells: [{ label: `v1 Elite renders at 1.0 and keeps the HISTORICAL ${r.out[3].bodyW}px body (legacy r27 x 1.4). Nemesis (legacy art) for reference.`, png: b64(buf) }],
    legend: [
      ['#40ff80', `physics body: regular ${r.out[1].bodyW}px wide in legacy and v1; elite ${r.out[3].bodyW}px in both (unchanged)`],
      ['#ffe040', `cfg.radius 20 / elite 27 — contact detonation at 48px and the 155px blast are measured from the body centre, unchanged`],
    ],
  });
  await page.close();
}

// ── 5. THE WARNING STRIP ─────────────────────────────────────────────────
// One body, staged on open floor at each stage of the frozen telegraph (t =
// 1 - dist/300); the real AI ticks there with its pulse phased onto the PEAK.
// The last column is the frame the frozen contact blast fires.
const STAGES = [['ARMED', 0, '>300px'], ['DISTANT', 0.15, '255px'], ['APPROACH', 0.35, '195px'], ['NEAR', 0.6, '120px'], ['IMMINENT', 0.82, '54px'], ['DETONATE', -1, '48px']];
async function warnStrip() {
  const shotRow = async (flags, elite) => {
    const page = await stillPage(flags);
    await page.evaluate((elite) => {
      const gs = window.__gs, g = window.game;
      g.scene.getScene('HUD')?.scene.setVisible(false);
      const P = gs.player; P.setVisible(false); P.weaponSprite?.setVisible(false);
      const hideP = () => { P.setVisible(false); P.weaponSprite?.setVisible(false); P.glowRing?.setVisible(false); P.shadow?.setVisible(false); };
      window.__stage = (t) => {
        for (const e of gs.enemies.getChildren().slice()) gs._destroyEnemyFully(e);
        const e = gs.spawnEnemyAt('bomber', 820, 700, elite ? { elite: true } : {});
        e.cfg = { ...e.cfg, speed: 0 };
        if (t < 0) {
          // detonating: walk him into contact for real and stop on the blast frame
          e.cfg = { ...e.cfg, speed: 300 };
          P.setPosition(820, 790); P.body.reset(P.x, P.y); P.setVisible(false);
          let n = 0; while (e.alive && n++ < 60) window.__adv(1);
          window.__adv(1);
        } else {
          const d = t === 0 ? 340 : (1 - t) * 300;
          P.setPosition(820, 700 + d); P.body.reset(P.x, P.y);
          const tt = Math.max(0, 1 - d / 300);
          e._bombPulse = Math.PI / 2 - 2 * (1000 / 60) * (0.006 + tt * 0.03);
          window.__adv(2);
        }
        gs.cameras.main.setScroll(820 - 360, 700 - 500); window.__quiet(); hideP();
        g.renderer.preRender(); g.scene.render(g.renderer); g.renderer.postRender();
        const cam = gs.cameras.main, wv = cam.worldView;
        return { x: Math.round(820 - 80 - wv.x + cam.x), y: Math.round(700 - 80 - wv.y + cam.y), w: e._payload?.w ?? null, tint: e._legacyWarnTint ?? e.tintTopLeft };
      };
    }, elite);
    const out = [];
    for (const [, t] of STAGES) {
      const r = await page.evaluate((t) => window.__stage(t), t);
      out.push({ buf: await page.screenshot({ clip: { x: r.x, y: r.y, width: 160, height: 170 } }), w: r.w, tint: r.tint });
    }
    await page.close();
    return out;
  };
  const L = await shotRow('', false), V = await shotRow(FLAGS, false), VE = await shotRow(FLAGS, true);
  const cells = [];
  const fmt = (w) => (w ? `L${w.lamp.toFixed(1)} S${w.status.toFixed(1)} H${w.heat.toFixed(1)}` : 'blast');
  STAGES.forEach(([n, t, d], i) => cells.push({ label: `LEGACY ${n} ${d}`, png: b64(L[i].buf) }));
  STAGES.forEach(([n, t, d], i) => cells.push({ label: `v1 ${n} ${d}`, png: b64(V[i].buf) }));
  STAGES.forEach(([n, t, d], i) => cells.push({ label: `v1 ELITE ${n}`, png: b64(VE[i].buf) }));
  // the 2x row: the body's own 80x84 around its centre, doubled
  const zoomed = await Promise.all(V.map((v) => composite([v.buf], { W: 160, H: 168, type: 'png', draws: [{ sx: 40, sy: 36, sw: 80, sh: 84, dx: 0, dy: 0, k: 2 }] })));
  STAGES.forEach(([n], i) => cells.push({ label: `v1 2x ${fmt(V[i].w)}`, png: b64(zoomed[i]), w: 160, h: 168 }));
  await compose(OUT + 'demolisher-warning-strip.png', {
    title: 'DEMOLISHER PROXIMITY WARNING — the frozen telegraph (t = 1 - dist/300, the pulse) at each stage, pulse PEAK; live runtime',
    cols: 6, cellW: 162, cellH: 170, cells,
    legend: [
      ['#ff9a5a', 'LEGACY: the whole body tinted by _tickSwarm (amplitude x t, rate grows with t).'],
      ['#7dff9a', 'v1: the SAME t and pulse, read off the payload hardware; the body is never tinted. 2x row: L lamp, S status lights, H heat (0-1).'],
      ['#ffd25a', 'arming indicator (chest strap, off-centre) + canister status lights: steady at range = ARMED; blinking on the pulse as he closes, amber -> red'],
      ['#ff6c24', 'payload heat (ADD, derived from the frame): the canisters and charges warm from ~255px, white-hot by contact; the Elite\'s cage carries it as contained red'],
      ['#aab0bd', 'contact at 48px is t 0.84 — nothing extends the window. DETONATING = the frame the frozen blast fires: the body and its payload go with it.'],
    ],
  });
}

// ── VIDEO helpers ────────────────────────────────────────────────────────
async function livePage(q, W = 720) {
  const page = await browser.newPage({ viewport: { width: W, height: 1280 } });
  page.on('pageerror', (e) => fail(`live: ${e.message}`));
  await page.goto(BASE + `?nodlg=1&nofreeze=1&${q}`);
  await stepBoot(page);
  return page;
}
async function run(page, file, FR, { per = 2, clip = { x: 0, y: 84, width: 720, height: 960 }, label, texts } = {}) {
  const vw = videoWriter(OUT + file);
  for (let f = 0; f < FR; f++) {
    const st = await page.evaluate((per) => window.__frame(per), per);
    const buf = await page.screenshot({ clip });
    const tx = texts ? texts(st, f) : [{ text: typeof label === 'function' ? label(st, f) : label, x: 10, y: clip.height + 24, size: 13, color: '#ffd9a0' }];
    await vw.write(await composite([buf], { W: clip.width, H: clip.height + 36, draws: [{ sx: 0, sy: 0, sw: clip.width, sh: clip.height, dx: 0, dy: 0 }], texts: tx }));
  }
  await vw.end();
  console.log('wrote', OUT + file);
}

// a scripted rush on open floor: Demolishers spawned on a bearing at a range
// rush a player who stands (or strafes); god mode keeps the player standing
const RUSH = (cfg) => `(() => {
  const gs = window.__gs, P = gs.player, cfg = ${JSON.stringify(cfg)};
  gs.arenaActive = false; gs._roomModifier = null;
  for (const e of gs.enemies.getChildren().slice()) gs._destroyEnemyFully(e);
  for (const o of gs.roomLayer.getChildren()) if (o.body && (o.displayWidth || 0) < 1000) o.body.enable = false;
  for (const w of gs.walls?.getChildren?.() || []) if (w.body) w.body.enable = false;
  gs.cameraDirector.update = () => {};
  P.setPosition(cfg.px, cfg.py); P.body.reset(P.x, P.y);
  gs.cameras.main.setScroll(cfg.px - 360, cfg.py - 520);
  window.__tick = 0; window.__note = '';
  window.__frame = (per) => {
    for (let k = 0; k < per; k++) {
      const i = window.__tick++;
      for (const s of cfg.spawns) if (s.at === i) { const e = gs.spawnEnemyAt('bomber', cfg.px + Math.cos(s.a) * s.d, cfg.py + Math.sin(s.a) * s.d, s.elite ? { elite: true } : {}); e.__label = s.label; }
      if (cfg.fire) for (const f of cfg.fire) if (i >= f[0] && i < f[1] && i % 7 === 0) P.keyboardFire();
      if (cfg.keep) { P.setPosition(cfg.px, cfg.py); P.body.reset(P.x, P.y); }
      window.__adv(1);
    }
    window.__quiet();
    const live = gs.enemies.getChildren().filter((e) => e.active && e.alive && e.enemyType === 'bomber');
    return live.map((e) => { const p = e._payload; const d = Math.round(Math.hypot(P.x - e.x, P.y - e.y)); return p ? \`\${e.__label || ''} \${d}px t\${p.t.toFixed(2)}\` : \`\${e.__label || ''} \${d}px\`; }).join('   ');
  };
})();`;

// ── 6. GAIT ──────────────────────────────────────────────────────────────
// A real Demolisher rushing a player who keeps backing off round a loop (so
// it runs every facing and never arrives), 1x on the left, 3x on the right.
async function gait() {
  const page = await livePage(`${FLAGS}&${STILL}`, 720);
  await quietRoom(page);
  await page.evaluate(() => {
    const gs = window.__gs, P = gs.player;
    const e = (window.__e = gs.spawnEnemyAt('bomber', 820, 400, {}));
    const E = (window.__E = gs.spawnEnemyAt('bomber', 820, 300, { elite: true }));
    gs.cameras.main.setScroll(820 - 360, 700 - 480);
    window.__tick = 0;
    window.__frame = (per) => {
      for (let k = 0; k < per; k++) {
        const i = window.__tick++;
        // the player circles 820,700 at radius 330, 1 lap per 6s (346px/s): always
        // ahead of the 300px/s runners, so they run every facing at their real speed
        const a = i / 360 * Math.PI * 2;
        P.setPosition(820 + Math.cos(a) * 330, 700 + Math.sin(a) * 330); P.body.reset(P.x, P.y);
        for (const b of [e, E]) if (b.alive && Math.hypot(P.x - b.x, P.y - b.y) < 90) { b.setPosition(820 - (P.x - 820) * 0.8, 700 - (P.y - 700) * 0.8); b.body.reset(b.x, b.y); }
        window.__adv(1);
      }
      window.__quiet();
      const f = (b) => `${b._elite ? 'E' : 'R'} ${(b.anims.currentAnim?.key || '').replace(/^ro-dem-[RE]-/, '')} f${b.frame.name} ${b._gait?.mode || ''} ${Math.round(Math.hypot(b.body.velocity.x, b.body.velocity.y))}px/s`;
      return { s: `${f(e)}   ${f(E)}`, x: e.x, y: e.y, cx: gs.cameras.main.worldView.x, cy: gs.cameras.main.worldView.y };
    };
  });
  const vw = videoWriter(OUT + 'demolisher-v1-gait.webm');
  for (let f = 0; f < 420; f++) {
    const st = await page.evaluate(() => window.__frame(2));
    const buf = await page.screenshot({ clip: { x: 0, y: 84, width: 720, height: 960 } });
    const zx = Math.round(st.x - st.cx - 40), zy = Math.round(st.y - st.cy - 46);
    await vw.write(await composite([buf], { W: 720 + 300, H: 960 + 36, draws: [{ sx: 0, sy: 0, sw: 720, sh: 960, dx: 0, dy: 0 }, { rect: '#000', dx: 720, dy: 0, dw: 300, dh: 960 },
      { sx: Math.max(0, zx), sy: Math.max(0, zy), sw: 80, sh: 92, dx: 724, dy: 20, k: 3.6 }],
    texts: [{ text: `1x live — gait v2 run, 80px cycle: ${st.s}`, x: 10, y: 984, size: 12, color: '#ffd9a0' }, { text: 'Regular, 3.6x', x: 730, y: 14, size: 12, color: '#aab0bd' }] }));
  }
  await vw.end();
  console.log('wrote', OUT + 'demolisher-v1-gait.webm');
  await page.close();
}

// ── 7. WARNING LIVE ──────────────────────────────────────────────────────
// Three real approaches at 1x, one from each painted side: he runs at a
// standing player from 560px, the warning builds, the frozen contact blast.
const APPROACH = { px: 820, py: 760, keep: true, spawns: [
  { at: 10, a: -Math.PI / 2, d: 560, label: 'front view' },
  { at: 200, a: Math.PI, d: 560, label: 'side view' },
  { at: 390, a: Math.PI / 2 - 0.15, d: 420, label: 'back view' },
  { at: 560, a: -Math.PI / 2 + 0.6, d: 560, elite: true, label: 'ELITE' },
] };
async function warnLive() {
  const page = await livePage(`${FLAGS}&${STILL}`);
  await quietRoom(page);
  await page.evaluate(RUSH(APPROACH));
  await run(page, 'demolisher-warning-live.webm', 380, { label: (st, f) => `1x real speed — ${st || '(blast)'}   t ${(f * 2 / 60).toFixed(1)}s` });
  await page.close();
}

// ── 8. WARNING A/B ───────────────────────────────────────────────────────
async function warnAB() {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1280 } });
  const q = `?nodlg=1&nofreeze=1&${STILL}`;
  await page.setContent(`<body style="margin:0;background:#000;display:flex"><iframe src="${BASE}${q}&move=v22&ab=0" width="720" height="1280" style="border:0"></iframe><iframe src="${BASE}${q}&${FLAGS}&ab=1" width="720" height="1280" style="border:0"></iframe></body>`);
  await page.waitForTimeout(2000);
  const fr = [0, 1].map((i) => page.frames().find((f) => f.url().includes(`&ab=${i}`)));
  if (fr.some((f) => !f)) fail('warnAB: iframes not found');
  for (const f of fr) { await stepBoot(f); await quietRoom(f); await f.evaluate(RUSH(APPROACH)); }
  const vw = videoWriter(OUT + 'demolisher-warning-ab.webm');
  let same = 0, n = 0;
  for (let k = 0; k < 380; k++) {
    await fr[0].evaluate(() => window.__frame(2)); const st = await fr[1].evaluate(() => window.__frame(2));
    if (k % 10 === 0) {
      const probe = () => window.__gs.enemies.getChildren().filter((e) => e.active).map((e) => `${e.x.toFixed(2)},${e.y.toFixed(2)},${e.hp},${e._bombPulse?.toFixed(4)}`).join('|') + `#${window.__gs.player.hp}`;
      n++; if (await fr[0].evaluate(probe) === await fr[1].evaluate(probe)) same++;
    }
    const buf = await page.screenshot({ clip: { x: 0, y: 84, width: 1440, height: 960 } });
    await vw.write(await composite([buf], { W: 1440, H: 960 + 40, draws: [{ sx: 0, sy: 0, sw: 1440, sh: 960, dx: 0, dy: 0 }, { rect: '#ffffff', dx: 718, dy: 0, dw: 4, dh: 960 }],
      texts: [{ text: 'LEGACY (default) — whole-body tint', x: 360, y: 960 + 27, align: 'center', bold: true, size: 17, color: '#ff9a8a' },
        { text: `?roster=v1 — payload hardware   ${st}`, x: 1080, y: 960 + 27, align: 'center', bold: true, size: 15, color: '#7dff9a' }] }));
  }
  await vw.end();
  console.log('wrote', OUT + 'demolisher-warning-ab.webm', `— the same scripted movement, identical state at ${same}/${n} checkpoints`);
  await page.close();
}

// ── 9-10. DETONATIONS ────────────────────────────────────────────────────
// contact: a real rush to contact, then the same rush again at 1/4 speed
async function contact() {
  const page = await livePage(`${FLAGS}&${STILL}`);
  await quietRoom(page);
  const cfg = { px: 820, py: 760, keep: true, spawns: [{ at: 10, a: -Math.PI / 2 - 0.3, d: 420, label: 'REGULAR' }, { at: 150, a: Math.PI - 0.4, d: 420, label: 'REGULAR (slow motion x4)' }, { at: 330, a: -0.5, d: 420, elite: true, label: 'ELITE' }] };
  await page.evaluate(RUSH(cfg));
  const vw = videoWriter(OUT + 'demolisher-contact-detonation.webm');
  for (let f = 0; f < 330; f++) {
    const slow = await page.evaluate(() => window.__tick >= 205 && window.__tick < 300);
    const st = await page.evaluate((per) => window.__frame(per), slow ? 1 : 2);
    if (slow) { /* each tick shown twice: x4 slower than real time */ }
    const buf = await page.screenshot({ clip: { x: 0, y: 84, width: 720, height: 960 } });
    const frame = await composite([buf], { W: 720, H: 996, draws: [{ sx: 0, sy: 0, sw: 720, sh: 960, dx: 0, dy: 0 }], texts: [{ text: `${slow ? 'SLOW MOTION x4 — ' : '1x — '}contact detonation at 48px (frozen): ${st || 'blast'}`, x: 10, y: 984, size: 13, color: slow ? '#9fe6ff' : '#ffd9a0' }] });
    await vw.write(frame); if (slow) await vw.write(frame);
  }
  await vw.end();
  console.log('wrote', OUT + 'demolisher-contact-detonation.webm');
  await page.close();
}
// death: the player fires at Demolishers rushing in; they are shot down at range
async function death() {
  const page = await livePage(`${FLAGS}&${STILL}`);
  await quietRoom(page);
  const cfg = { px: 820, py: 820, keep: true, fire: [[30, 200], [220, 400], [430, 640]], spawns: [{ at: 20, a: -Math.PI / 2, d: 560, label: 'REGULAR' }, { at: 210, a: -Math.PI / 2 - 0.5, d: 560, label: 'REGULAR' }, { at: 420, a: -Math.PI / 2 + 0.4, d: 560, elite: true, label: 'ELITE' }] };
  await page.evaluate(RUSH(cfg));
  await page.evaluate(() => { const gs = window.__gs; gs.events.on('enemy-died', (e) => { if (e.enemyType === 'bomber') window.__deaths = (window.__deaths || []).concat(`${e._elite ? 'E' : 'R'} shot down at ${Math.round(Math.hypot(gs.player.x - e.x, gs.player.y - e.y))}px`); }); });
  await run(page, 'demolisher-death-detonation.webm', 330, { label: (st, f) => `1x — shot down: the frozen death blast where he falls (x0.8). ${st}` });
  console.log(await page.evaluate(() => window.__deaths));
  await page.close();
}

// ── 11-12. ENCOUNTERS ────────────────────────────────────────────────────
const FIGHT = (seg) => `(() => {
  const gs = window.__gs, P = gs.player, seg = ${JSON.stringify(seg)};
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
    return Object.entries(c).map(([k, v]) => k + 'x' + v).join(' ');
  };
})();`;
const SEG = [[0, 160, ''], [160, 260, 'A'], [260, 380, 'W'], [380, 480, 'D'], [480, 600, 'S'], [600, 700, ''], [700, 820, 'A'], [820, 940, 'D'], [940, 99999, '']];
async function encounter(q, file, FR, title) {
  const page = await livePage(q);
  await page.evaluate(FIGHT(SEG));
  await page.evaluate(() => { const gs = window.__gs; window.__det = { contact: 0, death: 0 }; gs.events.on('enemy-died', (e) => { if (e.enemyType === 'bomber') window.__det[e._payload && e._detonated && Math.hypot(gs.player.x - e.x, gs.player.y - e.y) < 60 ? 'contact' : 'death']++; }); });
  await run(page, file, FR, { label: (st, f) => `${title} 1x — alive: ${st}   t ${(f * 2 / 60).toFixed(1)}s` });
  console.log(file, await page.evaluate(() => JSON.stringify(window.__det)));
  await page.close();
}

// ── 13. NEMESIS GUARD ────────────────────────────────────────────────────
async function nemesis() {
  const page = await livePage(`${FLAGS}&${STILL}`);
  await quietRoom(page);
  await page.evaluate(async () => {
    const gs = window.__gs, P = gs.player;
    const nm = await window.__mod(/data\/nemesis\.js/);
    P.setPosition(820, 820); P.body.reset(P.x, P.y);
    gs._spawnMiniBoss(nm.rollNemesis(8, { base: 'bomber', traits: [] }));
    const N = gs.enemies.getChildren().find((x) => x._miniBoss);
    N.setPosition(700, 520); N.body.reset(N.x, N.y);
    const D = gs.spawnEnemyAt('bomber', 1000, 470, {});
    gs.cameras.main.setScroll(820 - 360, 700 - 480);
    window.__bursts = 0; const cb = N._contactBurst.bind(N); N._contactBurst = (p) => { if (N._burstCd <= 0) window.__bursts++; return cb(p); };
    window.__tick = 0;
    window.__frame = (per) => {
      for (let k = 0; k < per; k++) { window.__tick++; P.setPosition(820, 820); P.body.reset(P.x, P.y); window.__adv(1); }
      window.__quiet();
      return `NEMESIS ${N.texture.key} hp ${N.hp}/${N.hpMax} ${N.alive ? 'alive' : 'DEAD'} bursts ${window.__bursts} payload-hook ${!!N._payload}   |   v1 Demolisher ${D.alive ? 'rushing' : 'detonated'}`;
    };
  });
  await run(page, 'demolisher-nemesis-guard.webm', 300, { label: (st) => `?roster=v1 — ${st}` });
  await page.close();
}

// ── 14. THE COMPLETE HIERARCHY ───────────────────────────────────────────
async function hierarchy() {
  const page = await stillPage();
  const y = await page.evaluate(() => {
    const gs = window.__gs, cam = gs.cameras.main;
    window.game.scene.getScene('HUD')?.scene.setVisible(false);
    const X0 = 120, Y0 = 600, DX = 108, DY = 128;
    const P = gs.player; P.setPosition(X0 + 300, Y0 + 1000); P.body.reset(P.x, P.y); P.setVisible(false); P.weaponSprite?.setVisible(false);
    cam.setScroll(X0 - 92, Y0 - 120);
    const roles = [['RIFLEMAN', 'grunt'], ['GUNNER', 'shooter'], ['BULWARK', 'shielded'], ['MARKSMAN', 'sniper'], ['DEMOLISHER', 'bomber']];
    const rows = [['REG', {}, Math.PI / 2 + 0.35], ['ELITE', { elite: true }, Math.PI / 2 + 0.35], ['REG', {}, 0], ['ELITE', { elite: true }, 0]];
    roles.forEach(([name, type], c) => {
      window.__lab(X0 + c * DX, Y0 - 70, name);
      rows.forEach(([rn, spec, aim], r) => {
        const xx = X0 + c * DX, yy = Y0 + r * DY;
        const e = gs.spawnEnemyAt(type, xx, yy, spec); window.__freeze(e, aim); if (e._shieldFacing != null) e._shieldFacing = aim; e.body.reset(xx, yy);
        if (c === 0) window.__lab(xx - 52, yy - 40, rn, 1, '#aab0bd');
      });
    });
    const c = gs.spawnChampion(X0 + 5 * DX + 30, Y0 + DY * 1.5, 'captain');
    window.__freeze(c, Math.PI / 2); const { dir } = c._facingSuffix(); c.play(`${c._animPrefix}-idle-${dir}`); c.body.reset(c.x, c.y);
    window.__lab(c.x, c.y - 92, 'CAPTAIN');
    window.__adv(3); window.__quiet(); window.__adv(1);
    return cam.y;
  });
  const buf = await page.screenshot({ clip: { x: 0, y, width: 720, height: 640 } });
  await compose(OUT + 'roster-v1-complete-hierarchy.png', {
    title: 'ROSTER v1 — ALL FIVE PRODUCTION ROLES and the unchanged Shock Captain — 1x, live runtime',
    cols: 1, cellW: 720, cellH: 640,
    cells: [{ label: 'rows: Regular / Elite aimed toward the camera (+20deg), then Regular / Elite aimed east. Hangar deck, no HUD.', png: b64(buf) }],
  });
  await page.close();
}

// ── PERF: the payload tick's own cost ────────────────────────────────────
async function perf() {
  const page = await livePage(`${FLAGS}&${STILL}`);
  await quietRoom(page);
  const r = await page.evaluate(async () => {
    const gs = window.__gs, P = gs.player, m = await window.__mod(/systems\/demolisherPayload\.js/);
    P.setPosition(820, 900); P.body.reset(P.x, P.y);
    const list = [];
    for (let i = 0; i < 8; i++) { const e = gs.spawnEnemyAt('bomber', 520 + i * 80, 650 + (i % 2) * 60, i % 3 ? {} : { elite: true }); e.cfg = { ...e.cfg, speed: 0 }; list.push(e); }
    window.__adv(3);
    const N = 4000, t0 = performance.now();
    for (let k = 0; k < N; k++) for (const e of list) { m.samplePayload(e._payload); m.drawPayload(e._payload); }
    const per = (performance.now() - t0) / (N * list.length);
    // whole frames: v1 with 8 payloads vs the same 8 with the payload tick removed
    const step = (n) => { const a = performance.now(); window.__adv(n); return (performance.now() - a) / n; };
    step(30); const on = step(240);
    const set = gs.__demPayloads, saved = [...set]; set.clear();
    step(30); const off = step(240);
    for (const p of saved) set.add(p);
    return { perDemolisherMs: per, frameOn: on, frameOff: off };
  });
  console.log(`payload sample + draw: ${(r.perDemolisherMs * 1000).toFixed(1)} us per Demolisher per frame; whole frame with 8 on the floor ${r.frameOn.toFixed(2)}ms (payload tick on) vs ${r.frameOff.toFixed(2)}ms (off)`);
  writeFileSync(OUT + 'demolisher-perf.json', JSON.stringify(r, null, 1));
  await page.close();
}

const steps = {
  sheets, facings, colliders, warnstrip: warnStrip, hier: hierarchy,
  gait, warnlive: warnLive, warnab: warnAB, contact, death,
  bomberrun: () => encounter(`${FLAGS}&encdbg=bomberRun&room=hangar&sector=8&wave=2`, 'demolisher-bomber-run-live.webm', 560, 'BOMBER RUN (hangar, sector 8, wave 2)'),
  mixed: () => encounter(`${FLAGS}&encdbg=mixed&room=detention&sector=12&wave=1`, 'demolisher-mixed-live.webm', 560, 'MIXED ASSAULT (detention, sector 12)'),
  nemesis, perf,
};
const STILLS = ['sheets', 'facings', 'colliders', 'warnstrip', 'hier'];
const VIDEOS = ['gait', 'warnlive', 'warnab', 'contact', 'death', 'bomberrun', 'mixed', 'nemesis'];
const todo = ARGS.length ? ARGS.flatMap((a) => (a === 'stills' ? STILLS : a === 'videos' ? VIDEOS : [a])) : [...STILLS, ...VIDEOS, 'perf'];
for (const s of todo) { if (!steps[s]) fail(`unknown step ${s}`); console.log('──', s); await steps[s](); }
await browser.close();
