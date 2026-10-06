// BULWARK SHIELD — ORIENTATION-INVARIANCE EVIDENCE. Same rules as
// shot-bulwark.mjs: the REAL runtime, the loop slept and stepped at exactly
// 1000/60, `Date.now` stepped with it, `Math.random` seeded, videos encoded at
// 30fps from every second tick (so they play at real 1x speed).
//
// The failure this exists to catch: the first field dimmed whatever part of it
// was routed to the FAR (behind-the-body) layers, so it was a full shield
// facing south, half a shield facing east or west and a ghost facing north.
// Every frame here puts the SAME field at the four compass facings, or turns
// one through 360 degrees, so a strength that depends on facing is visible.
//
// usage: node tests/shot-bulwark-orient.mjs [--base=http://localhost:5174/] [--tag=OLD] NAME...
//   idle4    bulwark-orientation-idle.png       Regular + Elite x S / E / N / W, one frame
//   rotate   bulwark-orientation-rotate.webm    one Regular + one Elite turned through 360
//   block4   bulwark-block-4way.png + .webm     the same real block at S / E / N / W
//   rapid    bulwark-rapid-side.webm            side-facing fields, paired hits on both halves
//   super4   bulwark-super-4way.webm            the same tear at S / E / N / W, then real Supers
//   vanguard bulwark-vanguard-orientation-live.webm  real VANGUARD, the player circling the pair
//   ab       bulwark-orientation-ab.webm        OLD (--old base) vs NEW, matched rotation + blocks
//   perf     prints the field's draw cost, idle and under events

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const ARGS = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const OUT = new URL('../docs/evidence/roster-bulwark/', import.meta.url).pathname;
const BASE = opt('base', 'http://localhost:5173/');
const OLD = opt('old', 'http://localhost:5174/');
const TAG = opt('tag', '');
const XSEC = JSON.parse(opt('xsec', 'null'));   // experiment only: CURTAIN overrides on the game's own module instance
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const FFMPEG = '/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux';
const SEED = 4242;
const STILL = 'encdbg=1&room=detention&sector=1';
const FLAGS = 'roster=v1&gait=v2&move=v22';
mkdirSync(OUT, { recursive: true });
const name = (f) => (TAG ? f.replace(/\.(png|webm)$/, `-${TAG}.$1`) : f);

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const fail = (m) => { console.error(`FAIL: ${m}`); process.exit(1); };
const b64 = (buf) => `data:image/png;base64,${buf.toString('base64')}`;
const COMPASS = [['SOUTH', Math.PI / 2], ['EAST', 0], ['NORTH', -Math.PI / 2], ['WEST', Math.PI]];

// ── harness ──────────────────────────────────────────────────────────────
async function stepBoot(frame) {
  await frame.waitForFunction(() => window.game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 45000 });
  await frame.evaluate(async ({ seed, xsec }) => {
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
    if (xsec) {
      const url = performance.getEntriesByType('resource').map((r) => r.name).find((n) => /systems\/bulwarkCurtain\.js/.test(n));
      Object.assign((await import(url)).CURTAIN, xsec);
    }
    window.__quiet = () => {
      const gs = window.__gs, hud = g.scene.getScene('HUD');
      gs.cameras.main.resetFX();
      gs._sectorTint?.setAlpha(0);
      if (hud) {
        hud.banner?.setAlpha(0);
        for (const o of hud.children.list) if (o.depth >= 47 && o.depth <= 49) o.setVisible(false);
      }
    };
    // hold a bearer still on a chosen facing: the AI yields while `_performing`
    // (it neither walks nor turns the shield), and the sprite's facing is read
    // from `_aim`, so writing both every tick IS the facing
    // wrapped to (-pi, pi], as atan2 hands it to the game — `_facingSuffix` reads
    // degrees in that range, and an unwrapped 274deg would pick the WEST body
    window.__face = (e, a) => { a = Math.atan2(Math.sin(a), Math.cos(a)); e._performing = true; e._movePlanted = true; e._aim = a; e._shieldFacing = a; e.setVelocity?.(0, 0); };
  }, { seed: SEED, xsec: XSEC });
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

// one compositor page for every frame: 1x crops and 2x NEAREST enlargements of
// the same screenshot, plus labels, drawn into one canvas
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
    // and every other static body (props such as the detention bunks are not in
    // roomLayer and would otherwise stop a staged shot halfway to its target)
    for (const b of gs.physics.world.staticBodies.getArray()) { b.enable = false; const o = b.gameObject; if (o && (o.displayWidth || 0) < 1000) o.setVisible?.(false); }
    gs.cameraDirector.update = () => {};
    window.__adv(1);
  });
}
async function stillFrame(frame) {
  await stepBoot(frame);
  await quietRoom(frame);
}
async function stillPage(base = BASE) {
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  page.on('pageerror', (e) => fail(`page: ${e.message}`));
  await page.goto(base + `?nodlg=1&nofreeze=1&${FLAGS}&${STILL}`);
  await stillFrame(page);
  return page;
}

// a row of bearers on the open escort floor, the player parked far away and
// hidden. Returns the camera's screen top so a clip can be placed on it.
const ROW = { X0: 560, DX: 172, Y0: 640 };
async function stageRow(frame, specs) {
  return frame.evaluate(({ specs, ROW }) => {
    const gs = window.__gs, cam = gs.cameras.main;
    const P = gs.player; P.setPosition(ROW.X0 + 260, ROW.Y0 + 700); P.body.reset(P.x, P.y); P.setVisible(false); P.weaponSprite?.setVisible(false);
    cam.setScroll(ROW.X0 - 102, ROW.Y0 - 330);
    window.__row = specs.map(([spec, a, dx = 0, dy = 0], i) => {
      const x = ROW.X0 + i * ROW.DX + dx, y = ROW.Y0 + dy;
      const e = gs.spawnEnemyAt('shielded', x, y, spec); window.__face(e, a); e.body.reset(x, y);
      e._homeX = x; e._homeY = y;
      return e;
    });
    window.__hold = () => { for (const e of window.__row) if (e.active) { window.__face(e, e._shieldFacing); e.body.reset(e._homeX, e._homeY); } };
    window.__adv(3); window.__hold(); window.__quiet(); window.__adv(1);
    return cam.y;
  }, { specs, ROW });
}
// screen-space centre of row member i, given the camera top
const rowCell = (camY, i, w = 168, h = 196) => ({ x: Math.round(102 + i * ROW.DX - w / 2), y: Math.round(camY + 330 - h / 2 - 6), w, h });
// a real player bolt from `dist` out along bearing `a` from the bearer, aimed at its centre
const BOLT = `window.__bolt = (e, a, dist = 110) => window.__gs.playerBullets.fire(e.x + Math.cos(a) * dist, e.y + Math.sin(a) * dist, a + Math.PI, 1100, 10, 900, { owner: 'player' });`;

// ── 1. IDLE 4-WAY ────────────────────────────────────────────────────────
async function idle4() {
  const page = await stillPage();
  const camY = await stageRow(page, [...COMPASS.map(([, a]) => [{}, a, 0, 0])]);
  // the Elite row: a second stage on the same frame, 230px further south
  await page.evaluate(({ ROW, COMPASS }) => {
    const gs = window.__gs;
    COMPASS.forEach(([, a], i) => {
      const x = ROW.X0 + i * ROW.DX, y = ROW.Y0 + 230;
      const e = gs.spawnEnemyAt('shielded', x, y, { elite: true }); window.__face(e, a); e.body.reset(x, y);
      e._homeX = x; e._homeY = y; window.__row.push(e);
    });
    window.__adv(3); window.__hold(); window.__quiet(); window.__adv(1);
  }, { ROW, COMPASS });
  const buf = await page.screenshot({ clip: { x: 0, y: camY + 196, width: 720, height: 470 } });
  const W = 1460, H = 44 + 22 + 470 + 30 + 940 + 64;
  const texts = [{ text: 'BULWARK FIELD — the SAME field at the four compass facings, ONE frame, live runtime. Regular row, Elite row.', x: 10, y: 26, bold: true, size: 16 }];
  const head = (y, lab, k) => { texts.push({ text: lab, x: 10, y: y - 6, color: '#aab0bd', size: 13 }); COMPASS.forEach(([n], i) => texts.push({ text: n, x: (k === 1 ? 370 : 10) + (102 + i * ROW.DX) * k, y: y + 14, align: 'center', bold: true, size: 13 * k })); };
  head(62, '1x (handset scale)', 1); head(62 + 22 + 470 + 30, '2x nearest — the same frame', 2);
  const all = await composite([buf], {
    W, H, type: 'png',
    draws: [{ sx: 0, sy: 0, sw: 720, sh: 470, dx: 370, dy: 66 }, { sx: 0, sy: 0, sw: 720, sh: 470, dx: 10, dy: 66 + 470 + 30 + 22, k: 2 }],
    texts: [...texts,
      { text: 'May differ: the shape turning, and which parts of it pass behind his body (the far half draws under him).', x: 10, y: H - 36, color: '#d0d4dc', size: 13 },
      { text: 'May NOT differ: frost, outer rim, keyline, inner edge, tips — one material at every facing.', x: 10, y: H - 14, color: '#d0d4dc', size: 13 }],
  });
  writeFileSync(OUT + name('bulwark-orientation-idle.png'), all);
  console.log('wrote', OUT + name('bulwark-orientation-idle.png'));
  await page.close();
}


// ── video plumbing: every frame is ONE 1x screenshot, composited with a 2x
// nearest enlargement of part of it and the labels the reviewer needs
async function record(page, file, frames, { clip, W, H, draws, texts }) {
  const vw = videoWriter(OUT + name(file));
  for (let f = 0; f < frames; f++) {
    const step = await page.evaluate((f) => window.__frame(f), f);
    if (step === 'skip') continue;
    const buf = await page.screenshot({ clip: typeof clip === 'function' ? clip(step) : clip });
    const tx = typeof texts === 'function' ? texts(step, f) : texts;
    const dr = typeof draws === 'function' ? draws(step) : draws;
    await vw.write(await composite([buf], { W, H, draws: dr, texts: tx }));
  }
  await vw.end();
  console.log('wrote', OUT + name(file));
}
const compass = (a) => {
  const d = ((Math.round((a * 180) / Math.PI) % 360) + 360) % 360;
  return `${String(d).padStart(3)}deg ${['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'][Math.round(d / 45) % 8]}`;
};

// ── 2. ROTATE: one Regular and one Elite turned through 360 degrees ───────
// 0.75s held facing south, then one full turn in 9s (clockwise on screen:
// S -> W -> N -> E -> S), then held again. Nothing else moves.
async function rotate() {
  const page = await stillPage();
  const camY = await page.evaluate(() => {
    const gs = window.__gs, cam = gs.cameras.main;
    const P = gs.player; P.setPosition(1200, 1300); P.body.reset(P.x, P.y); P.setVisible(false); P.weaponSprite?.setVisible(false);
    cam.setScroll(780 - 360, 640 - 300);
    const R = gs.spawnEnemyAt('shielded', 690, 640, {}), E = gs.spawnEnemyAt('shielded', 870, 640, { elite: true });
    window.__pair = [R, E];
    const HOLD = 45, TURN = 540;
    window.__frame = () => {
      for (let k = 0; k < 2; k++) {
        const i = (window.__tick = (window.__tick ?? -1) + 1);
        const u = Math.min(1, Math.max(0, (i - HOLD) / TURN));
        const a = Math.PI / 2 + u * 2 * Math.PI;
        window.__pair.forEach((e, j) => { window.__face(e, a); e.body.reset(j ? 870 : 690, 640); });
        window.__adv(1);
      }
      window.__quiet();
      return window.__pair[0]._shieldFacing;
    };
    window.__adv(2);
    return cam.y;
  });
  const clip = { x: 0, y: camY + 300 - 150, width: 720, height: 300 };
  await record(page, 'bulwark-orientation-rotate.webm', 330, {
    clip, W: 720, H: 44 + 300 + 26 + 540 + 34,
    draws: [{ sx: 0, sy: 0, sw: 720, sh: 300, dx: 0, dy: 44 }, { sx: 180, sy: 15, sw: 360, sh: 270, dx: 0, dy: 44 + 300 + 26, k: 2 }],
    texts: (a, f) => [{ text: 'ONE FIELD, TURNED THROUGH 360 — Regular (left), Elite (right)', x: 10, y: 20, bold: true, size: 15 },
      { text: `shield facing ${compass(a)}     t ${(f * 2 / 60).toFixed(2)}s     1x`, x: 10, y: 38, color: '#9fe6ff', size: 13 },
      { text: '2x nearest — the same frame', x: 10, y: 44 + 300 + 18, color: '#aab0bd', size: 12 },
      { text: 'ONE material at every facing: no fade, no half-ghost, no seam behind him', x: 10, y: 44 + 300 + 26 + 540 + 22, color: '#d0d4dc', size: 12 }],
  });
  await page.close();
}

// ── 3. BLOCK 4-WAY: the same real bolt into the same field at S / E / N / W ─
// Each bearer is fired on from 110px straight out along its own facing, all
// four on the same tick, so every reaction is the same age in every frame.
async function block4() {
  const page = await stillPage();
  await page.evaluate(BOLT);
  const camY = await stageRow(page, COMPASS.map(([, a]) => [{}, a]));
  const cells = [0, 1, 2, 3].map((i) => rowCell(camY, i, 150, 176));
  // ── the strip ──
  const PH = [['contact (bolt flattens: red smear)', 17], ['red propagating', 100], ['coral -> pink', 250], ['white (absorbed)', 420], ['recovered: idle', 900]];
  // 84px out: a 1100px/s bolt is stretched 1.77x and its hit circle with it (30px),
  // so from 110px a side-on bolt starts inside the NEIGHBOUR's reach (172px apart)
  await page.evaluate(() => { for (const e of window.__row) window.__bolt(e, e._shieldFacing, 84); });
  const shots = [];
  for (let i = 0, k = 0; k < PH.length && i < 140; i++) {
    const age = await page.evaluate(() => { window.__adv(1); window.__hold(); window.__quiet(); const v = window.__row.map((e) => e._curtain.snapshot().find((x) => x.kind === 'block')); return v.every(Boolean) ? Math.round(v[0].t) : (window.__row.every((e) => e._curtain.stats.blocks > 0) ? 9999 : -1); });
    if (age >= PH[k][1] || (k === PH.length - 1 && age === 9999)) { shots.push({ ph: PH[k][0], age, buf: await page.screenshot({ clip: { x: 0, y: camY, width: 720, height: 660 } }) }); k++; }
  }
  if (shots.length !== PH.length) fail(`block4: captured ${shots.length}/${PH.length} phases — ${await page.evaluate(() => JSON.stringify(window.__row.map((e) => ({ x: Math.round(e.x), y: Math.round(e.y), f: +e._shieldFacing.toFixed(2), b: e._curtain.stats.blocks, hp: e.hp }))))}`);
  const k2 = 2, CW = 150 * k2, CH = 176 * k2, GX = 140, top = 70;
  const draws = [], texts = [{ text: 'NORMAL BLOCK x 4 FACINGS — a real player bolt into the real field, all four on the same tick (2x nearest)', x: 10, y: 24, bold: true, size: 16 },
    { text: 'every row is ONE frame: the four reactions are the same age', x: 10, y: 46, color: '#aab0bd', size: 13 }];
  COMPASS.forEach(([n], i) => texts.push({ text: n, x: GX + i * (CW + 10) + CW / 2, y: top - 6, align: 'center', bold: true, size: 15 }));
  shots.forEach((sh, r) => {
    texts.push({ text: sh.ph, x: 10, y: top + r * (CH + 10) + 20, color: '#e4e7ee', size: 12 });
    texts.push({ text: sh.age === 9999 ? '(event gone)' : `${sh.age}ms`, x: 10, y: top + r * (CH + 10) + 38, color: '#9fe6ff', size: 12 });
    cells.forEach((c, i) => draws.push({ i: r, sx: c.x, sy: c.y - camY, sw: 150, sh: 176, dx: GX + i * (CW + 10), dy: top + r * (CH + 10), k: k2 }));
  });
  const png = await composite(shots.map((s) => s.buf), { W: GX + 4 * (CW + 10), H: top + PH.length * (CH + 10) + 50, draws, type: 'png',
    texts: [...texts, { text: 'RED = projectile energy still inside the field; coral / pink = being absorbed; WHITE = absorbed, the END of the reaction', x: 10, y: top + PH.length * (CH + 10) + 26, color: '#d0d4dc', size: 13 }] });
  writeFileSync(OUT + name('bulwark-block-4way.png'), png);
  console.log('wrote', OUT + name('bulwark-block-4way.png'));
  // ── the video: the same volley three times, real speed ──
  await page.evaluate(() => {
    window.__tick = 0;
    window.__frame = () => {
      for (let k = 0; k < 2; k++) {
        const i = window.__tick++;
        if (i % 66 === 20 && i < 220) for (const e of window.__row) window.__bolt(e, e._shieldFacing, 84);
        window.__adv(1); window.__hold();
      }
      window.__quiet();
      return window.__tick;
    };
  });
  const vc = rowCell(camY, 0, 168, 196);
  const SW = 168, SH = 196;
  await record(page, 'bulwark-block-4way.webm', 130, {
    clip: { x: 0, y: camY + 330 - 130, width: 720, height: 260 }, W: 720, H: 40 + 260 + 22 + 2 * (2 * SH) + 16,
    draws: [{ sx: 0, sy: 0, sw: 720, sh: 260, dx: 0, dy: 40 },
      ...[0, 1, 2, 3].map((i) => ({ sx: 102 + i * ROW.DX - SW / 2, sy: 130 - SH / 2 - 6, sw: SW, sh: SH, dx: (i % 2) * (2 * SW + 10) + 14, dy: 40 + 260 + 22 + Math.floor(i / 2) * 2 * SH, k: 2 }))],
    texts: [{ text: 'SAME BLOCK x 4 FACINGS — real bolts, same tick, real speed (1x above, 2x below)', x: 10, y: 18, bold: true, size: 14 },
      ...COMPASS.map(([n], i) => ({ text: n, x: 102 + i * ROW.DX, y: 36, align: 'center', bold: true, size: 12, color: '#9fe6ff' })),
      ...COMPASS.map(([n], i) => ({ text: n, x: (i % 2) * (2 * SW + 10) + 18, y: 40 + 260 + 18 + Math.floor(i / 2) * 2 * SH + (i > 1 ? 4 : 0), size: 12, color: '#9fe6ff' }))],
  });
  void vc;
  await page.close();
}

// ── 4. RAPID, SIDE-ON: paired hits on BOTH halves at the same age ────────
// An east-facing and a west-facing Regular. Every 10 ticks a PAIR of real
// bolts lands at facing +x and facing -x on the same tick — one on the near
// (southern) half, one on the far (northern) half — with x stepping through
// 0.3 / 0.6 / 0.9, plus single shots between them at the centre.
async function rapid() {
  const page = await stillPage();
  await page.evaluate(BOLT);
  const camY = await page.evaluate(() => {
    const gs = window.__gs, cam = gs.cameras.main;
    const P = gs.player; P.setPosition(1200, 1300); P.body.reset(P.x, P.y); P.setVisible(false); P.weaponSprite?.setVisible(false);
    cam.setScroll(780 - 360, 640 - 300);
    // back to back, fields facing OUT (west-facing on the left, east-facing on
    // the right), so neither one's bolts can reach the other
    const A = gs.spawnEnemyAt('shielded', 700, 640, {}), B = gs.spawnEnemyAt('shielded', 860, 640, {});
    window.__row = [A, B]; A._homeX = 700; B._homeX = 860; A._homeY = B._homeY = 640;
    window.__face(A, Math.PI); window.__face(B, 0);
    window.__hold = () => { for (const e of window.__row) { window.__face(e, e._shieldFacing); e.body.reset(e._homeX, e._homeY); } };
    window.__tick = 0;
    const OFF = [0.35, 0.65, 0.95, 0.65];
    window.__frame = () => {
      for (let k = 0; k < 2; k++) {
        const i = window.__tick++;
        // one PAIR every 20 ticks (3 a second): facing + x and facing - x on the
        // same tick, so the near-half hit and the far-half hit are the same age
        if (i >= 20 && i < 320 && i % 20 === 0) { const x = OFF[(i / 20) % 4]; for (const e of window.__row) { window.__bolt(e, e._shieldFacing + x); window.__bolt(e, e._shieldFacing - x); } }
        window.__adv(1); window.__hold();
      }
      window.__quiet();
      return window.__row.map((e) => e._curtain.events.filter((v) => v.kind === 'block').length).join(' / ');
    };
    window.__adv(2); window.__hold(); window.__quiet();
    return cam.y;
  });
  await record(page, 'bulwark-rapid-side.webm', 200, {
    clip: { x: 0, y: camY + 300 - 140, width: 720, height: 280 }, W: 720, H: 44 + 280 + 24 + 520 + 44,
    draws: [{ sx: 0, sy: 0, sw: 720, sh: 280, dx: 0, dy: 44 }, { sx: 180, sy: 10, sw: 360, sh: 260, dx: 0, dy: 44 + 280 + 24, k: 2 }],
    texts: (n) => [{ text: 'RAPID FIRE, SIDE-ON — every hit PAIRED: one on each half, same tick', x: 10, y: 20, bold: true, size: 15 },
      { text: `west-facing (left) / east-facing (right) — live block events ${n}     1x`, x: 10, y: 38, color: '#9fe6ff', size: 12 },
      { text: '2x nearest — the same frame', x: 10, y: 44 + 280 + 16, color: '#aab0bd', size: 12 },
      { text: 'upper half = FAR layer (under his body), lower half = NEAR layer (over it).', x: 10, y: 44 + 280 + 24 + 520 + 18, color: '#d0d4dc', size: 12 },
      { text: 'Each pair is the same age: the two reactions should carry the same weight.', x: 10, y: 44 + 280 + 24 + 520 + 36, color: '#d0d4dc', size: 12 }],
  });
  await page.close();
}

// ── 5. SUPER 4-WAY ───────────────────────────────────────────────────────
// Part A: four Elites at S / E / N / W; the same volley through the REAL
// pierce seam on the same ticks (an outer pellet first, a more central one a
// frame later — it takes the hole — and one more as a pinprick), twice.
// Part B: a REAL Super into one Elite at each facing in turn, at the real
// sector-25 hp ramp, generic hit FX and all.
async function super4() {
  const page = await stillPage();
  const camY = await stageRow(page, COMPASS.map(([, a]) => [{ elite: true }, a]));
  await page.evaluate(() => {
    const gs = window.__gs;
    gs.enemyHpMult = 3.0;                           // the real ramp at sector 25 (1 + 25 x 0.08): a whole Super, crits and all, leaves it standing
    window.__tick = 0; window.__part = 'A';
    const volley = (i) => {
      for (const e of window.__row) {
        if (i === 0) e._curtain.pierce({ off: 0.22 });
        if (i === 1) { e._curtain.pierce({ off: 0.04 }); e._curtain.pierce({ off: -0.32 }); }
      }
    };
    window.__frame = () => {
      for (let k = 0; k < 2; k++) {
        const i = window.__tick++;
        if (window.__part === 'A') {
          if (i >= 20 && i < 22) volley(i - 20);
          if (i >= 110 && i < 112) volley(i - 110);
          if (i === 200) {
            // part B: one Elite at a time, the player in front of it
            for (const e of window.__row.slice()) gs._destroyEnemyFully(e);
            window.__part = 'B'; window.__bi = -1; window.__tick = 0;
          }
        } else {
          const j = Math.floor(i / 84);
          if (j > 3) return 'end';
          if (j !== window.__bi) {
            window.__bi = j;
            for (const e of (window.__row || []).slice()) if (e.active) gs._destroyEnemyFully(e);
            const a = [Math.PI / 2, 0, -Math.PI / 2, Math.PI][j];
            const X = 980, Y = 640;                  // clear floor: at x 818 a detention bunk stops a Super from the north
            const e = gs.spawnEnemyAt('shielded', X, Y, { elite: true }); window.__face(e, a); e.body.reset(X, Y);
            e._homeX = X; e._homeY = Y; window.__row = [e];
            const P = gs.player; P.setVisible(true); P.weaponSprite?.setVisible(true);
            P.setPosition(X + Math.cos(a) * 260, Y + Math.sin(a) * 260); P.body.reset(P.x, P.y);
            window.__superAt = i + 14;
          }
          if (i === window.__superAt) { const P = gs.player, e = window.__row[0]; P.superCharge = 999; const ok = P.tryFireSuper(Math.atan2(e.y - P.y, e.x - P.x)); window.__dbg = `fired ${ok} P ${Math.round(P.x)},${Math.round(P.y)} alive ${P.alive} e ${Math.round(e.x)},${Math.round(e.y)} hp ${Math.round(e.hp)}`; }
          if (i === window.__superAt + 30) window.__dbg += ` | +30: pierces ${window.__row[0]._curtain?.stats.pierces} hp ${Math.round(window.__row[0].hp)} active ${window.__row[0].active}`;
        }
        window.__adv(1); if (window.__row?.[0]?.active) window.__hold();
      }
      window.__quiet();
      return { dbg: window.__dbg, part: window.__part, j: window.__bi, ev: window.__row.map((e) => (e.active ? e._curtain.snapshot().map((v) => `${v.kind}${Math.round(v.t)}`).join(',') : 'dead')).join(' | '), alive: window.__row.every((e) => e.alive) };
    };
  });
  const SW = 168, SH = 196;
  const H = 40 + 300 + 22 + 2 * (2 * SH) + 20;
  let lastB = null, lastDbg = null;
  await record(page, 'bulwark-super-4way.webm', 100 + 4 * 42, {
    clip: (st) => ({ x: 0, y: camY + 330 - 150, width: 720, height: 300 }), W: 720, H,
    draws: (st) => (st.part === 'A'
      ? [{ sx: 0, sy: 0, sw: 720, sh: 300, dx: 0, dy: 40 },
        ...[0, 1, 2, 3].map((i) => ({ sx: 102 + i * ROW.DX - SW / 2, sy: 150 - SH / 2 - 6, sw: SW, sh: SH, dx: (i % 2) * (2 * SW + 10) + 14, dy: 40 + 300 + 22 + Math.floor(i / 2) * 2 * SH, k: 2 }))]
      : [{ sx: 0, sy: 0, sw: 720, sh: 300, dx: 0, dy: 40 }, { sx: 980 - (ROW.X0 - 102) - 180, sy: 0, sw: 360, sh: 300, dx: 0, dy: 40 + 300 + 22, k: 2 }]),
    texts: (st) => {
      if (st.part === 'B' && st.dbg && st.dbg !== lastDbg) { lastDbg = st.dbg; if (/\+30/.test(st.dbg)) console.log(`super4 B ${['S', 'E', 'N', 'W'][st.j]}: ${st.dbg}`); }
      if (st.part === 'B' && st.j !== lastB && /tear/.test(st.ev)) { lastB = st.j; console.log(`super4 B facing ${['S', 'E', 'N', 'W'][st.j]}: ${st.ev}${st.alive ? '' : ' (bearer died)'}`); }
      return st.part === 'A'
        ? [{ text: 'SUPER TEAR x 4 FACINGS — the same volley through the real pierce seam, same ticks', x: 10, y: 18, bold: true, size: 14 },
          { text: `PUNCTURE -> OPEN -> HEAL, twice.  ${st.ev}`, x: 10, y: 34, color: '#9fe6ff', size: 11 },
          ...COMPASS.map(([n], i) => ({ text: n, x: (i % 2) * (2 * SW + 10) + 18, y: 40 + 300 + 18 + Math.floor(i / 2) * 2 * SH + (i > 1 ? 4 : 0), size: 12, color: '#9fe6ff' }))]
        : [{ text: `REAL SUPER, Elite at sector-25 hp — facing ${COMPASS[Math.max(0, st.j)][0]} (S, E, N, W in turn)`, x: 10, y: 18, bold: true, size: 14 },
          { text: `generic hit FX included (frozen).  ${st.ev}${st.alive ? '' : '  (bearer died)'}`, x: 10, y: 34, color: '#9fe6ff', size: 11 }];
    },
  });
  await page.close();
}

// ── 6. VANGUARD, LIVE: the player circles the pair so the fields turn ─────
async function vanguardLive() {
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  page.on('pageerror', (e) => fail(`vanguard: ${e.message}`));
  await page.goto(BASE + `?nodlg=1&nofreeze=1&${FLAGS}&encdbg=vanguard&room=hangar&sector=8&wave=2&nochamp=1`);
  await stepBoot(page);
  await page.evaluate(() => {
    const gs = window.__gs;
    window.__tick = 0;
    window.__bins = {};
    // hold while the front forms and closes, then walk a loop round it
    // (west, north, east, south, west) firing at the real cadence
    const seg = [[0, 400, ''], [400, 470, 'A'], [470, 600, 'W'], [600, 760, 'D'], [760, 880, 'S'], [880, 1000, 'A'], [1000, 1090, 'W'], [1090, 1200, 'D'], [1200, 99999, '']];
    window.__frame = () => {
      for (let k = 0; k < 2; k++) {
        const i = window.__tick++;
        const cur = seg.find(([a, b]) => i >= a && i < b)[2], K = gs.keys;
        K.A.isDown = cur === 'A'; K.D.isDown = cur === 'D'; K.W.isDown = cur === 'W'; K.S.isDown = cur === 'S';
        if (i >= 300 && i % 9 === 0) gs.player.keyboardFire();
        window.__adv(1);
        for (const e of gs.enemies.getChildren()) {
          if (!e.active || !e.alive || !e._curtain) continue;
          const d = ((Math.round((e._shieldFacing * 180) / Math.PI) % 360) + 360) % 360;
          const b = ['E', 'S', 'W', 'N'][Math.round(d / 90) % 4];
          window.__bins[b] = (window.__bins[b] || 0) + 1;
        }
      }
      window.__quiet();
      return gs.enemies.getChildren().filter((e) => e.active && e.alive && e._curtain).map((e) => `${e._elite ? 'E' : 'R'} ${['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'][Math.round((((e._shieldFacing * 180) / Math.PI % 360) + 360) % 360 / 45) % 8]}`).join('   ');
    };
  });
  await record(page, 'bulwark-vanguard-orientation-live.webm', 640, {
    clip: { x: 0, y: 84, width: 720, height: 960 }, W: 720, H: 960 + 36,
    draws: [{ sx: 0, sy: 0, sw: 720, sh: 960, dx: 0, dy: 0 }],
    texts: (st, f) => [{ text: `VANGUARD live, 1x — Bulwark shield facings: ${st || '(none on the floor yet)'}   t ${(f * 2 / 60).toFixed(1)}s`, x: 10, y: 960 + 23, color: '#9fe6ff', size: 13 }],
  });
  console.log('facing bins (bearer-ticks):', JSON.stringify(await page.evaluate(() => window.__bins)));
  await page.close();
}

// ── 7. A/B: OLD build vs NEW, the same rotation and the same blocks ───────
// Three panels, each a separate game in its own iframe, stepped identically:
// OLD (the build the handset rejected), NEW MATERIAL ONLY (the near/far
// attenuation removed, the old cross-section kept), and NEW (shipped: the
// attenuation removed AND the band's lean reduced). One Regular turns through
// 360 degrees in 9s while a real bolt hits its current facing every 0.9s.
async function ab() {
  const panels = [['OLD (rejected)', OLD, null, '#ff9a8a'], ['NEW: material only', BASE, { inR: 6, inH: 5 }, '#ffe08a'], ['NEW (shipped)', BASE, null, '#7dff9a']];
  const page = await browser.newPage({ viewport: { width: 720 * 3, height: 1280 } });
  const q = `?nodlg=1&nofreeze=1&${FLAGS}&${STILL}`;
  await page.setContent(`<body style="margin:0;background:#000;display:flex">${panels.map(([, b], i) => `<iframe src="${b}${q}&ab=${i}" width="720" height="1280" style="border:0"></iframe>`).join('')}</body>`);
  await page.waitForTimeout(2000);
  const frames = panels.map((_, i) => page.frames().find((f) => f.url().includes(`&ab=${i}`)));
  if (frames.some((f) => !f)) fail('ab: iframes not found');
  let camY = 0;
  for (let i = 0; i < 3; i++) {
    const f = frames[i];
    await f.waitForFunction(() => window.game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 45000 });
    await stillFrame(f);
    if (panels[i][2]) {
      await f.evaluate(async (xsec) => {
        const url = performance.getEntriesByType('resource').map((r) => r.name).find((n) => /systems\/bulwarkCurtain\.js/.test(n));
        Object.assign((await import(url)).CURTAIN, xsec);
      }, panels[i][2]);
    }
    await f.evaluate(BOLT);
    camY = await f.evaluate(() => {
      const gs = window.__gs, cam = gs.cameras.main;
      const P = gs.player; P.setPosition(1200, 1300); P.body.reset(P.x, P.y); P.setVisible(false); P.weaponSprite?.setVisible(false);
      cam.setScroll(780 - 360, 640 - 300);
      const e = gs.spawnEnemyAt('shielded', 780, 640, {});
      window.__tick = 0;
      window.__frame = () => {
        for (let k = 0; k < 2; k++) {
          const i = window.__tick++;
          const a = Math.PI / 2 + Math.min(1, Math.max(0, (i - 30) / 540)) * 2 * Math.PI;
          window.__face(e, a); e.body.reset(780, 640);
          if (i >= 40 && i % 54 === 40) window.__bolt(e, a);
          window.__adv(1);
        }
        window.__quiet();
        return e._shieldFacing;
      };
      window.__adv(2);
      return cam.y;
    });
  }
  const vw = videoWriter(OUT + name('bulwark-orientation-ab.webm'));
  const C = 230, k2 = 2, PW = C * k2;
  for (let fr = 0; fr < 320; fr++) {
    const a = await frames[0].evaluate(() => window.__frame());
    for (let i = 1; i < 3; i++) await frames[i].evaluate(() => window.__frame());
    const buf = await page.screenshot({ clip: { x: 0, y: camY + 300 - C / 2 - 6, width: 720 * 3, height: C } });
    const draws = [], texts = [{ text: 'OLD vs NEW — the same Regular turned through 360 (9s), a real bolt into its current facing every 0.9s (2x nearest)', x: 10, y: 20, bold: true, size: 14 },
      { text: `shield facing ${compass(a)}`, x: 10, y: 40, color: '#9fe6ff', size: 13 }];
    panels.forEach(([lab, , , col], i) => {
      draws.push({ sx: i * 720 + 360 - C / 2, sy: 0, sw: C, sh: C, dx: 10 + i * (PW + 10), dy: 74, k: k2 });
      texts.push({ text: lab, x: 10 + i * (PW + 10) + PW / 2, y: 66, align: 'center', bold: true, size: 15, color: col });
    });
    texts.push({ text: 'OLD: the far half (behind him) drawn at half strength — full facing south, half a shield side-on, a ghost facing north.', x: 10, y: 74 + PW + 22, size: 12, color: '#d0d4dc' });
    texts.push({ text: 'MATERIAL ONLY: one strength everywhere, but the band still thins to ~5px from behind (its 7px lean).', x: 10, y: 74 + PW + 40, size: 12, color: '#d0d4dc' });
    texts.push({ text: 'NEW: one strength AND a band of near-constant depth (lean 2px): 19 / 17 / 15px south / side / north.', x: 10, y: 74 + PW + 58, size: 12, color: '#d0d4dc' });
    await vw.write(await composite([buf], { W: 10 + 3 * (PW + 10), H: 74 + PW + 70, draws, texts }));
  }
  await vw.end();
  console.log('wrote', OUT + name('bulwark-orientation-ab.webm'));
  await page.close();
}

// ── PERF: the field's own CPU cost per frame, idle and under fire ─────────
async function perf() {
  const res = {};
  for (const [lab, base] of [['OLD', OLD], ['NEW', BASE]]) {
    const page = await stillPage(base);
    await page.evaluate(BOLT);
    res[lab] = await page.evaluate(() => {
      const gs = window.__gs, out = {};
      const P = gs.player; P.setPosition(1200, 1400); P.body.reset(P.x, P.y);
      const es = [];
      for (let i = 0; i < 6; i++) { const x = 480 + (i % 3) * 200, y = 520 + Math.floor(i / 3) * 220, e = gs.spawnEnemyAt('shielded', x, y, {}); e._homeX = x; e._homeY = y; e.hp = e.hpMax = 1e9; es.push(e); }
      const facings = [Math.PI / 2, 0, -Math.PI / 2, Math.PI, Math.PI / 4, -3 * Math.PI / 4];
      let t = 0;
      for (const e of es) { const d = e._curtain.draw.bind(e._curtain); e._curtain.draw = () => { const a = performance.now(); d(); t += performance.now() - a; }; }
      const hold = () => es.forEach((e, i) => { window.__face(e, facings[i]); e.body.reset(e._homeX, e._homeY); });
      const run = (n, fire) => { t = 0; for (let i = 0; i < n; i++) { if (fire && i % 3 === 0) for (const e of es) window.__bolt(e, e._shieldFacing + ((i / 3) % 5 - 2) * 0.3); window.__adv(1); hold(); } return t / n / es.length; };
      hold(); window.__adv(30);
      const idle = [], fire = [];
      for (let r = 0; r < 5; r++) { idle.push(run(240, false)); fire.push(run(240, true)); }
      const med = (a) => a.slice().sort((p, q) => p - q)[2];
      out.idle = +med(idle).toFixed(4); out.fire = +med(fire).toFixed(4);
      out.events = es.map((e) => e._curtain.stats.blocks);
      return out;
    });
    await page.close();
  }
  console.log('field draw cost, ms per field per frame (median of 5 x 240 frames, 6 fields, desktop Chromium):', JSON.stringify(res));
}

const steps = { idle4, rotate, block4, rapid, super4, vanguard: vanguardLive, ab, perf };
const ALL = ['idle4', 'rotate', 'block4', 'rapid', 'super4', 'vanguard', 'ab', 'perf'];
for (const s of (ARGS.length ? ARGS : ALL).flatMap((a) => (a === 'all' ? ALL : [a]))) { if (!steps[s]) fail(`unknown step ${s}`); console.log('──', s); await steps[s](); }
await browser.close();
