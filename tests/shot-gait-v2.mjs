// GAIT v2 EVIDENCE. Same rig rules as shot-roster-gunner / shot-roster-2b:
// stepped loop, stepped Date.now, seeded Math.random, 30fps video from every
// second 60Hz tick. Every controlled clip is CURRENT (left) vs ?gait=v2
// (right) on IDENTICAL scripted motion, so the only difference is the legs.
// usage: node tests/shot-gait-v2.mjs <stills|controlled|ab|live|all> [outdir]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
const MODE = process.argv[2] || 'all';
const OUT = process.argv[3] || new URL('../docs/evidence/roster-gait-v2/', import.meta.url).pathname;
const BASE = 'http://localhost:5173/';
const FFMPEG = '/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const fail = (m) => { console.error(`FAIL: ${m}`); process.exit(1); };
const KEYS = [['GUNNER R', 'ro-gun-R'], ['GUNNER E', 'ro-gun-E'], ['RIFLEMAN R', 'ro-rif-R'], ['RIFLEMAN E', 'ro-rif-E'], ['MARKSMAN R', 'ro-mrk-R'], ['MARKSMAN E', 'ro-mrk-E']];

async function stepBoot(frame) {
  await frame.waitForFunction(() => window.game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 45000 });
  await frame.evaluate(async () => {
    const g = window.game; g.loop.sleep();
    let s = 12345; Math.random = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    window.__t = 1e5; Date.now = () => window.__t;
    window.__adv = (n = 1) => { for (let i = 0; i < n; i++) { window.__t += 1000 / 60; g.step(window.__t, 1000 / 60); } };
    g.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 4242 }); window.__adv(2);
    const url = performance.getEntriesByType('resource').map((r) => r.name).find((n) => /systems\/debug\.js/.test(n));
    (await import(url)).setGodMode(true);
    window.__gs = g.scene.getScene('Game');
    for (let i = 0; i < 300 && !window.__gs.roomSpec; i++) window.__adv(1);
    window.__adv(20);
    window.__quiet = () => {
      const gs = window.__gs, hud = g.scene.getScene('HUD');
      gs.cameras.main.resetFX(); gs._sectorTint?.setAlpha(0);
      if (hud) { hud.banner?.setAlpha(0); if (hud.encText) for (const o of hud.children.list) if (o.depth >= 47 && o.depth <= 49) o.setVisible(false); }
    };
  });
}
function videoWriter(file) {
  const ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', '30', '-i', 'pipe:0',
    '-vf', 'format=yuv420p', '-c:v', 'vp8', '-b:v', '6M', '-crf', '6', '-qmin', '2', '-qmax', '28', '-auto-alt-ref', '0', file]);
  ff.stdin.on('error', (e) => fail(`ffmpeg: ${e.message}`));
  return {
    write: (buf) => new Promise((res) => { if (ff.stdin.write(buf)) res(); else ff.stdin.once('drain', res); }),
    end: () => new Promise((res) => { ff.on('close', res); ff.stdin.end(); }),
  };
}
async function canvasPng(file, fn, arg) {
  const page = await browser.newPage();
  await page.goto(BASE + '?nodlg=1&roster=v1&gait=v2');
  await page.waitForFunction(() => window.game?.textures?.exists('ro-mrk-E'), null, { timeout: 45000 });
  const url = await page.evaluate(fn, arg);
  writeFileSync(OUT + file, Buffer.from(url.split(',')[1], 'base64'));
  console.log('wrote', OUT + file);
  await page.close();
}

// ── STILLS ─────────────────────────────────────────────────────────────────
// The CURRENT sheets are read from a page without the flag and handed over as
// images, so one canvas can put old and new side by side.
async function sheetsOld() {
  const page = await browser.newPage();
  await page.goto(BASE + '?nodlg=1&roster=v1');
  await page.waitForFunction(() => window.game?.textures?.exists('ro-mrk-E'), null, { timeout: 45000 });
  const out = await page.evaluate((keys) => Object.fromEntries(keys.map(([, k]) => [k, window.game.textures.get(k).getSourceImage().toDataURL()])), KEYS);
  await page.close();
  return out;
}
const SHEET_FN = async ({ keys, old, groups, title, scales }) => {
  const T = window.game.textures, fw = 96, fh = 104;
  const load = async (src) => { const i = new Image(); i.src = src; await i.decode(); return i; };
  const oldImg = {}; for (const [k, v] of Object.entries(old)) oldImg[k] = await load(v);
  const sections = [];
  for (const S of scales) sections.push({ S, label: `GAIT v2 — ${S}x${S > 1 ? ' (diagnostic, nearest-neighbour)' : ' (native)'}`, src: (k) => T.get(k).getSourceImage() });
  sections.push({ S: 1, label: 'CURRENT production gait — 1x, for comparison', src: (k) => oldImg[k] });
  const cols = groups.reduce((a, g) => a + g.frames.length, 0);
  let H = 40; for (const sec of sections) H += 26 + keys.length * (fh * sec.S + 6);
  const W = 120 + cols * (fw * Math.max(...scales) + 4);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.fillStyle = '#212328'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#e4e7ee'; x.font = 'bold 15px monospace'; x.fillText(title, 10, 24);
  let y = 40;
  for (const sec of sections) {
    x.fillStyle = '#ffd27a'; x.font = 'bold 13px monospace'; x.fillText(sec.label, 10, y + 16); y += 26;
    for (const [name, k] of keys) {
      x.fillStyle = '#c8ccd6'; x.font = '11px monospace'; x.fillText(name, 8, y + fh * sec.S / 2);
      let cx = 120;
      for (const gr of groups) for (const [f, lab] of gr.frames) {
        x.drawImage(sec.src(k), f * fw, 0, fw, fh, cx, y, fw * sec.S, fh * sec.S);
        if (k === keys[0][1]) { x.fillStyle = '#8a8f9c'; x.font = '10px monospace'; x.fillText(lab, cx, y - 2); }
        cx += fw * sec.S + 4;
      }
      y += fh * sec.S + 6;
    }
  }
  return c.toDataURL();
};
async function stills() {
  const old = await sheetsOld();
  const lab = ['idle', 'walk 1 contact', 'walk 2 load', 'walk 3 pass', 'walk 4 contact', 'walk 5 load', 'walk 6 pass', 'fire'];
  await canvasPng('gait-v2-side-frames.png', SHEET_FN, { keys: KEYS, old, scales: [1, 3], title: 'GAIT v2 — SIDE (east source; west = mirrored). Columns: idle, walk 1-6, fire',
    groups: [{ frames: lab.map((l, i) => [16 + i, l]) }] });
  await canvasPng('gait-v2-frontback-frames.png', SHEET_FN, { keys: KEYS, old, scales: [1, 2], title: 'GAIT v2 — FRONT walk 1-6 | BACK walk 1-6',
    groups: [{ frames: [1, 2, 3, 4, 5, 6].map((f, i) => [f, `F${i + 1}`]) }, { frames: [9, 10, 11, 12, 13, 14].map((f, i) => [f, `B${i + 1}`]) }] });
  // the strafe frames have no "current" counterpart: their own small sheet
  await canvasPng('gait-v2-strafe-frames.png', async ({ keys }) => {
    const T = window.game.textures, fw = 96, fh = 104, S = 2;
    const c = document.createElement('canvas'); c.width = 120 + 18 * (fw + 4); c.height = 40 + keys.length * (fh + 6);
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.fillStyle = '#212328'; x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = '#e4e7ee'; x.font = 'bold 15px monospace'; x.fillText('GAIT v2 STRAFE frames 33-50 (1x): front 1-6 (stepping screen-right), back 1-6, profile marking time 1-6', 10, 24);
    keys.forEach(([name, k], r) => { x.fillStyle = '#c8ccd6'; x.font = '11px monospace'; x.fillText(name, 8, 40 + r * (fh + 6) + 50);
      for (let i = 0; i < 18; i++) x.drawImage(T.get(k).getSourceImage(), (33 + i) * fw, 0, fw, fh, 120 + i * (fw + 4), 40 + r * (fh + 6), fw, fh); });
    void S; return c.toDataURL();
  }, { keys: KEYS });
  // ANATOMY OVERLAY — joints from the same tables the painter used
  await canvasPng('gait-v2-anatomy-overlay.png', async () => {
    const url = performance.getEntriesByType('resource').map((r) => r.name).find((n) => /systems\/rosterPaint\.js/.test(n));
    const m = await import(url), T = window.game.textures, fw = 96, fh = 104, S = 4, P = 4;   // P: world px per logical px
    const roles = [['RIFLEMAN R', 'ro-rif-R', 18], ['MARKSMAN R', 'ro-mrk-R', 16]];
    const fr = [['idle', 16, m.SIDE2.idle], ...m.SIDE2.walk.map((sp, i) => [`walk ${i + 1}`, 17 + i, sp]), ['fire', 23, m.SIDE2.fire]];
    const c = document.createElement('canvas'); c.width = 20 + fr.length * (fw * S / 2 + 8); c.height = 80 + roles.length * (fh * S / 2 + 30);
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.fillStyle = '#16181d'; x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = '#e4e7ee'; x.font = 'bold 14px monospace'; x.fillText('ANATOMY OVERLAY (diagnostic) — pelvis ▪ hip ● knee ● ankle ● ; near leg solid, far leg dashed', 10, 22);
    const top = (st) => (st === 'S' ? 21 : st === 'H' ? 22 : 23);
    roles.forEach(([name, k, hip0], r) => {
      const y0 = 50 + r * (fh * S / 2 + 30);
      x.fillStyle = '#c8ccd6'; x.font = '12px monospace'; x.fillText(name, 10, y0 - 4);
      fr.forEach(([lab, f, sp], i) => {
        const X0 = 10 + i * (fw * S / 2 + 8), sc = S / 2, Z = P * sc;          // logical px -> canvas px
        x.drawImage(T.get(k).getSourceImage(), f * fw, 0, fw, fh, X0, y0, fw * sc, fh * sc);
        x.fillStyle = '#8a8f9c'; x.font = '10px monospace'; x.fillText(lab, X0, y0 + fh * sc + 12);
        const hip = hip0 + sp.bob, pt = (lx, ly) => [X0 + (lx + 0.5) * Z, y0 + (ly + 0.5) * Z];
        x.fillStyle = '#ffe040'; const [px_, py_] = pt(11.5, hip - 0.5); x.fillRect(px_ - 5, py_ - 5, 10, 10);
        for (const [leg, dash, col] of [[sp.F, [4, 3], '#ff7ad9'], [sp.N, [], '#40e0ff']]) {
          const kY = hip + Math.max(1, Math.floor((top(leg.st) - hip) / 2)) - (leg.st === 'S' ? 1 : 0);
          const H = pt(11.5, hip), K = pt(11.5 + leg.k, kY), A = pt(11.5 + leg.f, top(leg.st) - 0.5);
          x.setLineDash(dash); x.strokeStyle = col; x.lineWidth = 2;
          x.beginPath(); x.moveTo(...H); x.lineTo(...K); x.lineTo(...A); x.lineTo(A[0] + 2.5 * Z, A[1]); x.stroke(); x.setLineDash([]);
          x.fillStyle = col; for (const p of [H, K, A]) { x.beginPath(); x.arc(p[0], p[1], 3.5, 0, 7); x.fill(); }
        }
      });
    });
    return c.toDataURL();
  });
}

// ── CONTROLLED clips: current | v2, identical scripted motion ─────────────
async function pair(q) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1280 } });
  const a = `${BASE}?nodlg=1&nofreeze=1&roster=v1&${q}`;
  await page.setContent(`<body style="margin:0;background:#000;display:flex;position:relative">
    <iframe src="${a}" width="720" height="1280" style="border:0"></iframe><iframe src="${a}&gait=v2" width="720" height="1280" style="border:0"></iframe>
    <div style="position:absolute;left:0;top:1236px;width:720px;text-align:center;font:bold 22px monospace;color:#fff;background:#000a;padding:6px 0">CURRENT gait</div>
    <div style="position:absolute;left:720px;top:1236px;width:720px;text-align:center;font:bold 22px monospace;color:#7dff9a;background:#000a;padding:6px 0">?gait=v2</div>
    <div style="position:absolute;left:718px;top:0;width:4px;height:1280px;background:#fff"></div></body>`);
  await page.waitForTimeout(1500);
  const fr = page.frames().slice(1);
  const L = fr.find((f) => f.url() === a), R = fr.find((f) => f.url() === a + '&gait=v2');
  if (!L || !R) fail('pair: iframes');
  await stepBoot(L); await stepBoot(R);
  return { page, L, R };
}
// a stage of frozen-AI actors the script moves: `_performing` makes the AI
// yield; the base class still picks facing and animation from aim + velocity
const STAGE = (spec) => {
  const gs = window.__gs, cam = gs.cameras.main;
  gs.arenaActive = false; gs._roomModifier = null;
  for (const e of gs.enemies.getChildren().slice()) gs._destroyEnemyFully(e);
  for (const o of gs.roomLayer.getChildren()) { if ((o.displayWidth || 0) >= 1000) continue; o.setVisible(false); if (o.body) o.body.enable = false; }
  for (const o of gs.children.list) if (o.type === 'Text') o.setVisible(false);
  gs.cameraDirector.update = () => {};
  const P = gs.player; P.setPosition(spec.px, spec.py); P.body.reset(P.x, P.y); P.setVisible(false); P.weaponSprite?.setVisible(false);
  cam.setScroll(spec.sx, spec.sy);
  window.__actors = spec.actors.map(([type, elite, x, y, label]) => {
    const e = gs.spawnEnemyAt(type, x, y, elite ? { elite: true } : {});
    e._performing = true; e._movePlanted = false; e.fireCd = 1e9; e.body.reset(x, y);
    if (label) gs.add.text(x, y - 70, label, { fontFamily: 'monospace', fontSize: '12px', color: '#e4e7ee', backgroundColor: '#000a' }).setOrigin(0.5).setDepth(9999).setScrollFactor(1);
    e.__lab = label; return e;
  });
  window.__tick = 0;
  window.__frame = (n) => { for (let j = 0; j < n; j++) { window.__script(window.__tick++); window.__adv(1); } window.__quiet(); };
};
async function controlled(file, spec, script, FR) {
  const { page, L, R } = await pair('encdbg=1&room=detention&sector=1');
  for (const f of [L, R]) { await f.evaluate(STAGE, spec); await f.evaluate(script); }
  const vw = videoWriter(OUT + file);
  for (let i = 0; i < FR; i++) { await L.evaluate(() => window.__frame(2)); await R.evaluate(() => window.__frame(2)); await vw.write(await page.screenshot({ type: 'jpeg', quality: 90 })); }
  await vw.end(); console.log('wrote', OUT + file); await page.close();
}
const SIX = [['shooter', 0, 'GUNNER R'], ['shooter', 1, 'GUNNER E'], ['grunt', 0, 'RIFLEMAN R'], ['grunt', 1, 'RIFLEMAN E'], ['sniper', 0, 'MARKSMAN R'], ['sniper', 1, 'MARKSMAN E']];
async function controlledAll() {
  // SIDE: each actor walks east, stands, walks west (aim along travel = profile)
  await controlled('gait-v2-side-live.webm', { px: 700, py: 1500, sx: 280, sy: 380, actors: SIX.map(([t, e, l], i) => [t, e, 420, 520 + i * 130, l]) },
    () => { window.__script = (i) => { const ph = Math.floor(i / 150) % 4, v = [150, 0, -150, 0][ph];
      for (const e of window.__actors) { e._aim = v < 0 ? Math.PI : 0; e.setVelocity(v * (e.cfg.speed / 230 + 0.35), 0); } }; }, 300);
  // FRONT/BACK: toward the camera (aim S), stand, away (aim N)
  await controlled('gait-v2-frontback-live.webm', { px: 700, py: 1600, sx: 330, sy: 300, actors: SIX.map(([t, e, l], i) => [t, e, 400 + i * 110, 520, l]) },
    () => { window.__script = (i) => { const ph = Math.floor(i / 150) % 4, v = [130, 0, -130, 0][ph];
      for (const e of window.__actors) { e._aim = v < 0 ? -Math.PI / 2 : Math.PI / 2; e.setVelocity(0, v); } }; }, 300);
  // SPEED SYNC: three Riflemen side by side at 50 / 140 / 230 px/s, eased in and out like v2.2
  await controlled('gait-v2-speed-sync.webm', { px: 700, py: 1500, sx: 280, sy: 380, actors: [['grunt', 0, 380, 560, 'SLOW 50px/s'], ['grunt', 0, 380, 720, 'NORMAL 140px/s'], ['grunt', 0, 380, 880, 'FAST 230px/s']] },
    () => { window.__script = (i) => { const ph = i % 240, ramp = ph < 30 ? ph / 30 : ph < 150 ? 1 : ph < 180 ? 1 - (ph - 150) / 30 : 0, dir = Math.floor(i / 240) % 2 ? -1 : 1;
      window.__actors.forEach((e, k) => { e._aim = dir < 0 ? Math.PI : 0; e.setVelocity(dir * [50, 140, 230][k] * ramp, 0); }); }; }, 300);
}

// ── REAL encounters ────────────────────────────────────────────────────────
const PLAYER = `window.__drive = (i) => { const gs = window.__gs, k = gs.keys; if (!k) return;
  const seg = [[0,150,''],[150,250,'D'],[250,300,''],[300,410,'A'],[410,470,''],[470,550,'W'],[550,640,'S'],[640,700,''],[700,790,'D'],[790,880,'A'],[880,980,''],[980,1060,'S'],[1060,1140,'W'],[1140,99999,'']];
  const cur = seg.find(([a,b]) => i >= a && i < b)[2]; k.A.isDown = cur === 'A'; k.D.isDown = cur === 'D'; k.W.isDown = cur === 'W'; k.S.isDown = cur === 'S';
  if (i >= 700 && i % 10 === 0) gs.player.keyboardFire(); };
  window.__tick = 0; window.__frame = (n) => { for (let j = 0; j < n; j++) { window.__drive(window.__tick++); window.__adv(1); } window.__quiet(); };`;
async function abEnc() {
  const { page, L, R } = await pair('move=v22&encdbg=crossfire&room=corridor&sector=14&wave=1');
  await L.evaluate(PLAYER); await R.evaluate(PLAYER);
  const vw = videoWriter(OUT + 'gait-v2-ab.webm');
  let same = 0, n = 0;
  for (let i = 0; i < 540; i++) {
    await L.evaluate(() => window.__frame(2)); await R.evaluate(() => window.__frame(2));
    await vw.write(await page.screenshot({ type: 'jpeg', quality: 88 }));
    if (i % 30 === 0) { const st = () => window.__gs.enemies.getChildren().filter((e) => e.active).map((e) => `${e.x.toFixed(3)},${e.y.toFixed(3)},${e.hp}`).join('|'); n++; if (await L.evaluate(st) === await R.evaluate(st)) same++; }
  }
  await vw.end(); console.log('wrote gait-v2-ab.webm — identical state at', same, '/', n); await page.close();
}
async function live() {
  const vw = videoWriter(OUT + 'roster-gait-v2-live.webm');
  for (const enc of ['crossfire', 'sniperNest']) {
    const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
    page.on('pageerror', (e) => fail(`live: ${e.message}`));
    await page.goto(`${BASE}?nodlg=1&nofreeze=1&roster=v1&gait=v2&move=v22&encdbg=${enc}&room=corridor&sector=14&wave=1`);
    await stepBoot(page); await page.evaluate(PLAYER);
    for (let i = 0; i < 390; i++) { await page.evaluate(() => window.__frame(2)); await vw.write(await page.screenshot({ type: 'jpeg', quality: 90 })); }
    await page.close();
  }
  await vw.end(); console.log('wrote roster-gait-v2-live.webm');
}
const run = { stills, controlled: controlledAll, ab: abEnc, live };
if (MODE === 'all') { for (const f of Object.values(run)) await f(); } else if (run[MODE]) await run[MODE](); else fail(`unknown ${MODE}`);
await browser.close();
