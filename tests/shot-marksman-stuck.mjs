// EVIDENCE — PHASE 3C: the ordinary Marksman's stuck-recovery candidates.
// Writes docs/evidence/marksman-stuck-v3c/*.webm. Every panel is the live game
// on THIS tree with its REAL URL flag (no flag / ?marksmanStuck=prog /
// ?marksmanStuck=early), stepped deterministically (seeded Math.random, a 60Hz
// fixed step) with the Phase 3A observe-only instrument installed — the same
// runtime `diag-marksman-stuck.mjs` measures (staged scenarios are its own
// `__mkStep`; encounters replay its `encRun` script tick for tick). Videos run
// 2 game ticks per 30fps frame — real 1x speed. The AI is never frozen, and
// the sniper laser in frame is the game's own (nothing here draws a beam).
//
// RENDERING IS NOT RNG-NEUTRAL, SO THE FILM IS SIMULATED HEADLESS. A real
// `game.step` renders, and render-time code (camera shake on a Super, the HUD)
// draws from `Math.random` — the seeded gameplay stream — so a filmed fight
// drifted off the measured one (first divergence tick 675 in SNIPER NEST).
// The simulation steps exactly as the metrics do (`headlessStep`), every
// shutter render and overlay draw runs on a throwaway generator (an overlay
// label is a Phaser Text, keyed by UUID() — 31 draws), and each video VERIFIES
// itself: the audit hash and draw count of every tick are compared with a
// plain headless replay of the same case, and a mismatch fails the run.
//
// THE OVERLAY IS DIAGNOSTIC, drawn by this rig only, on Marksmen only:
//   trail          the path the Marksman actually ran (spawn dot at its start)
//   RED ring       a base stuck check armed a sidestep and the body TOOK it
//   GREEN ring     the base armed one and the CANDIDATE stood it down
//   BLUE ring      Candidate B armed a check the base declined (approach-pinned)
//   AMBER ring     armed, never taken (it ran out during a hold)
//   thick red ring + SIDESTEP label   the body is taking a sidestep now
//   label          MARKSMAN / ELITE + its tick's branch (HOLD, APPROACH,
//                  RETREAT) and the weapon (CHARGE, LOCK) — read, never set
//
// usage: node tests/shot-marksman-stuck.mjs [clear hold obstacle nest mixed]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { CHROME, bootPage, installAudit } from './diag-stuck-audit.mjs';
import { installMkRig, encRun, ENC_SEG, MK, MKE, OBST } from './diag-marksman-stuck.mjs';

const ARGS = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const OUT = new URL('../docs/evidence/marksman-stuck-v3c/', import.meta.url).pathname;
const FFMPEG = '/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const fail = (m) => { console.error(`FAIL: ${m}`); process.exit(1); };
const b64 = (buf) => `data:image/png;base64,${buf.toString('base64')}`;

const MODE = {
  baseline: { flags: '', title: 'BASELINE — frozen (no flag)', short: 'BASELINE', color: '#ff9a8a' },
  A: { flags: 'marksmanStuck=prog', title: 'CANDIDATE A — ?marksmanStuck=prog', short: 'CANDIDATE A', color: '#9fe0a8' },
  B: { flags: 'marksmanStuck=early', title: 'CANDIDATE B — ?marksmanStuck=early', short: 'CANDIDATE B', color: '#9fc8ff' },
};

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
  window.__comp = async (srcs, { W, H, draws, texts = [], bg = '#121418' }) => {
    const imgs = await Promise.all(srcs.map(window.__img));
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    x.fillStyle = bg; x.fillRect(0, 0, W, H);
    for (const d of draws) x.drawImage(imgs[d.i || 0], d.sx, d.sy, d.sw, d.sh, d.dx, d.dy, d.sw, d.sh);
    for (const t of texts) { x.font = `${t.bold ? 'bold ' : ''}${t.size || 14}px monospace`; x.fillStyle = t.color || '#e4e7ee'; x.textAlign = t.align || 'left'; x.fillText(t.text, t.x, t.y); }
    return c.toDataURL('image/jpeg', 0.92);
  };
});
async function composite(bufs, spec) {
  const url = await comp.evaluate(({ srcs, spec }) => window.__comp(srcs, spec), { srcs: bufs.map(b64), spec });
  return Buffer.from(url.split(',')[1], 'base64');
}

// ── a rendered page, real flag, observe-only instrument, the overlay ─────
async function evPage(mode, { q, shared = '', seed } = {}) {
  const p = await bootPage(browser, { flags: [shared, MODE[mode].flags].filter(Boolean).join('&'), ...(q ? { q } : {}), ...(seed ? { seed } : {}) });
  await installAudit(p, 'A');
  await installMkRig(p);
  await p.evaluate(() => {
    const gs = window.__gs, A = window.__aud;
    window.__headless = true;   // simulate exactly as the metrics do; see the header
    window.__tr = [];
    const g = gs.add.graphics().setDepth(9500);
    const T = [];
    const txt = (i) => T[i] || (T[i] = gs.add.text(0, 0, '', { fontFamily: 'monospace', fontSize: '15px', color: '#fff', stroke: '#000', strokeThickness: 4 }).setDepth(9501).setOrigin(0.5, 1));
    window.__ov = { trails: new Map() };
    const isMk = (r) => r.type === 'sniper' && !r.nem;
    // THE CANDIDATE'S OWN DECISIONS, read from its log after every tick
    const snap = new Map();
    const track = () => {
      for (const r of A.recs) {
        const l = r.e._marksmanStuck?.log; if (!l) continue;
        const s = snap.get(r) || { st: 0, kp: 0, ap: 0 };
        const st = l.stoodF1 + l.stoodHold + l.stoodRetreat;
        const last = [...r.checks].reverse().find((c) => c.armed);
        if (st > s.st && last) last.cand = 'stood';
        if (l.keptPinned > s.kp && last) last.cand = 'kept';
        if (l.armedPinned > s.ap) (r.bArms ||= []).push({ x: r.e.x, y: r.e.y, tick: A.tick });
        snap.set(r, { st, kp: l.keptPinned, ap: l.armedPinned });
      }
    };
    const adv = window.__adv;
    window.__adv = (n = 1) => { for (let i = 0; i < n; i++) { adv(1); window.__tr.push([A.hash(), window.__draws, A.recs.map((q) => `${q.type}@${q.e.x.toFixed(2)},${q.e.y.toFixed(2)}`).join(' ')]); track(); } };
    window.__quietStaged = () => {
      window.game.scene.getScene('HUD')?.scene.setVisible(false);
      for (const o of gs.roomLayer.getChildren()) if ((o.displayWidth || 0) < 1000 && !o.__audWall) o.setVisible(false);
      for (const t of gs.terminals || []) { for (const k of Object.values(t)) if (k?.setVisible) k.setVisible(false); t.setVisible?.(false); }
      for (const w of gs.weaponPickups || []) { w.setVisible?.(false); for (const k of Object.values(w)) if (k?.setVisible) k.setVisible(false); }
      for (const q of gs.envLight?.parts || []) (q.img || q.image || q)?.setVisible?.(false);
      gs.cameraDirector.update = () => {};
    };
    // the shutter render AND the overlay run on their own generator: whatever
    // they draw never reaches the seeded gameplay stream (or its counter).
    // The overlay needs it as much as the render — every `add.text` label
    // keys its canvas texture with Phaser's UUID(), 31 Math.random calls each,
    // and a label is created the first time a Marksman needs one.
    let rs = 0x2545f491;
    const renderRng = () => ((rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0) / 4294967296);
    const isolated = (fn) => (...a) => { const keep = Math.random; Math.random = renderRng; try { return fn(...a); } finally { Math.random = keep; } };
    window.__render = isolated(() => { const gm = window.game; gm.renderer.preRender(); gm.scene.render(gm.renderer); gm.renderer.postRender(); });
    window.__place = (cx, cy, zoom) => { const cam = gs.cameras.main; cam.setZoom(zoom); cam.centerOn(cx, cy); };
    window.__clipFor = (x0, y0, w, h) => {
      const cam = gs.cameras.main, wv = cam.worldView, z = cam.zoom;
      return { x: Math.round(cam.x + (x0 - wv.x) * z), y: Math.round(cam.y + (y0 - wv.y) * z), width: Math.round(w * z), height: Math.round(h * z) };
    };
    window.__draw = () => {
      const P = gs.player;
      g.clear();
      let k = 0;
      for (const r of A.recs) {
        if (!isMk(r)) continue;
        const e = r.e;
        let tr = window.__ov.trails.get(r);
        if (!tr) { tr = [[r.sx, r.sy]]; window.__ov.trails.set(r, tr); }
        if (e.active) tr.push([e.x, e.y]);
        const col = r.elite ? 0xf0a8ff : 0xd8a8ff;
        g.lineStyle(3, col, 0.95); g.beginPath(); g.moveTo(tr[0][0], tr[0][1]); for (const [x, y] of tr) g.lineTo(x, y); g.strokePath();
        g.fillStyle(col, 1); g.fillCircle(r.sx, r.sy, 5);
        for (const c of r.checks) if (c.armed) {
          const ringCol = c.cand === 'stood' ? 0x60ff90 : c.cons > 0 ? 0xff3030 : 0xffb030;
          g.lineStyle(c.cons > 0 || c.cand ? 3 : 2, ringCol, 1); g.strokeCircle(c.x, c.y, 18);
        }
        for (const b of r.bArms || []) { g.lineStyle(3, 0x50a0ff, 1); g.strokeCircle(b.x, b.y, 24); }
        const taking = e.active && e.alive && r.pbr === 2 && e._stuckSidestepMs > 0;
        if (taking) { g.lineStyle(4, 0xff3030, 1); g.strokeCircle(e.x, e.y, (e.displayHeight || 60) * 0.55); }
        if (e.active && e.alive) {
          const d = Math.hypot(P.x - e.x, P.y - e.y);
          const br = d < e.cfg.retreatRange ? 'RETREAT' : d > e.cfg.desiredRange + 80 ? 'APPROACH' : 'HOLD';
          const wpn = e._charging ? (e._chargeMs <= e.cfg.lockMs ? ' · LOCK' : ' · CHARGE') : '';
          const t = txt(k++);
          t.setText(`${r.elite ? 'ELITE ' : ''}MARKSMAN\n${taking ? `SIDESTEP ${r.open?.cls || r.popen?.cls || (r.bArms?.length ? 'PINNED (B)' : '')}` : br}${wpn}`);
          t.setColor(taking ? '#ff6a5a' : '#ffffff').setPosition(e.x, e.y - (e.displayHeight || 60) * 0.55 - 4).setVisible(true).setScale(1 / gs.cameras.main.zoom * 0.8);
        }
      }
      for (let i = k; i < T.length; i++) T[i].setVisible(false);
      gs._sectorTint?.setAlpha(0);
    };
    window.__draw = isolated(window.__draw);
    // per-panel counts for the caption (ordinary Marksmen only)
    window.__stats = () => {
      const s = { taken: 0, takenF1: 0, takenHold: 0, takenBlock: 0, stood: 0, bArms: 0, sideMs: 0, n: 0 };
      for (const r of A.recs) {
        if (!isMk(r)) continue;
        s.n++;
        for (const c of r.checks) if (c.armed) {
          if (c.cand === 'stood') s.stood++;
          if (c.cons > 0) { s.taken++; if (c.cls[0] === 'F') s.takenF1++; else if (c.cls[0] === 'H') s.takenHold++; else if (c.cls[0] === 'B') s.takenBlock++; }
        }
        s.bArms += (r.bArms || []).length; s.sideMs += Math.round(r.sideTicks * 1000 / 60);
      }
      return s;
    };
  });
  return p;
}

// ── staged videos: N pages in lockstep, the diag's own player keyframes ──
async function stagedVideo(file, panels, { region, zoom, frames, per = 2, label, cols = panels.length, foot = () => [], rowTitles = null }) {
  frames = +opt('frames', frames);   // a shorter debug pass; the evidence uses the default
  const pages = [];
  for (const pn of panels) {
    const p = await evPage(pn.mode);
    await p.evaluate(async ({ sc, region, zoom }) => {
      await window.__mkSetup(sc);
      window.__tr = [];
      window.__quietStaged(); window.__ov.trails.clear();
      window.__place(region[0] + region[2] / 2, region[1] + region[3] / 2, zoom);
      window.__draw(); window.__render();
    }, { sc: pn.sc, region, zoom });
    pages.push(p);
  }
  const clip = await pages[0].evaluate((r) => window.__clipFor(...r), region);
  const vw = videoWriter(OUT + file);
  const head = rowTitles ? 20 : 0, lab = 22, ft = 52, gap = 8, rows = Math.ceil(panels.length / cols);
  const rowH = head + lab + clip.height + ft;
  const W = Math.max(cols * clip.width + (cols - 1) * gap, 640), H = rows * rowH + 46;
  let last;
  for (let f = 0; f < frames; f++) {
    const shots = [];
    for (const p of pages) {
      const st = await p.evaluate((per) => {
        for (let i = 0; i < per; i++) window.__mkStep();
        window.__draw(); window.__render();
        const r = window.__aud.recs.find((q) => q.type === 'sniper'), e = r?.e, P = window.__gs.player;
        return { ...window.__stats(), d: e ? Math.round(Math.hypot(P.x - e.x, P.y - e.y)) : null, contact: r?.firstContact };
      }, per);
      shots.push({ buf: await p.screenshot({ clip }), st });
    }
    const draws = [], texts = [];
    if (rowTitles) rowTitles.forEach((rt, r) => texts.push({ text: rt, x: 6, y: r * rowH + 15, size: 13, bold: true, color: '#ffd9a0' }));
    panels.forEach((pn, j) => {
      const x = (j % cols) * (clip.width + gap), y = Math.floor(j / cols) * rowH + head;
      draws.push({ i: j, sx: 0, sy: 0, sw: clip.width, sh: clip.height, dx: x, dy: y + lab });
      texts.push({ text: pn.title, x: x + 6, y: y + 16, size: 12, bold: true, color: MODE[pn.mode].color });
      const st = shots[j].st;
      const lines = [[`taken ${st.taken} · stood ${st.stood} · B ${st.bArms}`, MODE[pn.mode].color],
        [`F1 ${st.takenF1} · hold ${st.takenHold} · contact ${st.takenBlock}`, MODE[pn.mode].color], ...[].concat(foot(st, pn)).map((t) => [t, '#cfd6e4'])];
      lines.forEach(([t, color], k) => texts.push({ text: t, x: x + 6, y: y + lab + clip.height + 14 + k * 13, size: 11, color }));
    });
    texts.push({ text: label(f), x: 8, y: H - 24, size: 12, color: '#ffd9a0' });
    texts.push({ text: LEGEND, x: 8, y: H - 7, size: 11, color: '#cfd6e4' });
    await vw.write(await composite(shots.map((s) => s.buf), { W, H, draws, texts }));
    last = shots.map((s) => s.st);
  }
  await vw.end();
  // the film must BE the measured runtime: replay each panel's case headless
  // on a plain page and compare every tick
  for (let j = 0; j < pages.length; j++) {
    const got = await pages[j].evaluate(() => window.__tr);
    await pages[j].evaluate(() => window.__mkCollect()); await pages[j].close();
    const ref = await page0(panels[j].mode).then(async (p) => {
      const r = await p.evaluate(async ({ sc, n }) => {
        await window.__mkSetup(sc);
        const A = window.__aud, tr = [];
        for (let i = 0; i < n; i++) { window.__mkStep(); tr.push([A.hash(), window.__draws, A.recs.map((q) => `${q.type}@${q.e.x.toFixed(2)},${q.e.y.toFixed(2)}`).join(' ')]); }
        window.__mkCollect();
        return tr;
      }, { sc: panels[j].sc, n: got.length });
      await p.close();
      return r;
    });
    verify(file, panels[j].mode, got, ref);
  }
  console.log('wrote', OUT + file, JSON.stringify(last));
}
// a plain metrics page: the real flag, the instrument, the Marksman rig, no overlay
async function page0(mode, { q, shared = '', seed } = {}) {
  const p = await bootPage(browser, { flags: [shared, MODE[mode].flags].filter(Boolean).join('&'), ...(q ? { q } : {}), ...(seed ? { seed } : {}) });
  await installAudit(p, 'A');
  await installMkRig(p);
  await p.evaluate(() => { window.__headless = true; });
  return p;
}
function verify(file, mode, got, ref) {
  const d = got.findIndex((x, i) => x[0] !== ref[i]?.[0] || x[1] !== ref[i]?.[1]);
  if (d !== -1 || got.length !== ref.length) fail(`${file} ${mode}: the filmed run left the measured one at tick ${d} (${got.length} vs ${ref.length} ticks)\n  film ${JSON.stringify(got.slice(Math.max(0, d - 1), d + 2))}\n  ref  ${JSON.stringify(ref.slice(Math.max(0, d - 1), d + 2))}`);
  console.log(`  verified ${file} ${mode}: ${got.length} ticks identical to the headless metrics replay`);
}
const t = (f, per = 2) => (f * per / 60).toFixed(1);
const LEGEND = 'rings: RED taken · GREEN stood down (candidate) · BLUE armed by B · AMBER armed, unused';
const ALL = ['baseline', 'A', 'B'];

// ── A. CLEAR APPROACH: Regular and Elite, standing player ───────────────
async function clear() {
  const sc = { seed: 1001, ticks: 99999, player: [[0, 800, 1250]], actors: [{ ...MK, x: 560, y: 150, at: 0 }, { ...MKE, x: 1040, y: 150, at: 0 }] };
  await stagedVideo('marksman-stuck-clear-ab.webm', ALL.map((m) => ({ mode: m, title: MODE[m].title, sc })), {
    region: [420, 90, 760, 1200], zoom: 0.4, frames: 240,
    foot: (st) => `sideways, both Marksmen: ${st.sideMs}ms`,
    label: (f) => `1x — same seed, open floor, standing player. Regular (left), Elite (right). First base check at 0.60s.  t ${t(f)}s`,
  });
}

// ── B. HOLD -> APPROACH -> RETREAT: the player holds, backs off, closes ──
async function hold() {
  const sc = { seed: 1001, ticks: 99999, player: [[0, 800, 950], [240, 800, 950], [300, 800, 1350], [480, 800, 1350], [560, 800, 820], [720, 800, 820]],
    actors: [{ ...MK, x: 650, y: 500, at: 0 }, { ...MKE, x: 950, y: 500, at: 0 }] };
  await stagedVideo('marksman-stuck-hold-resume.webm', ALL.map((m) => ({ mode: m, title: MODE[m].title, sc })), {
    region: [480, 300, 640, 1100], zoom: 0.45, frames: 360,
    foot: (st) => `sideways, both: ${st.sideMs}ms`,
    label: (f) => { const i = f * 2; const ph = i < 240 ? 'player holds (band)' : i < 300 ? 'player backs off past 640' : i < 480 ? 'Marksmen approach' : i < 560 ? 'player closes inside 300' : 'Marksmen retreat'; return `1x — Regular (left), Elite (right). ${ph}.  t ${t(f)}s`; },
  });
}

// ── C. OBSTACLES: cover met inside the first window (top), head-on after it (bottom)
async function obstacle() {
  const panels = [];
  for (const scn of ['console70-early', 'cover90']) for (const m of ALL) panels.push({ mode: m, title: MODE[m].short, sc: { ...OBST[scn](MK, 1001), ticks: 99999 } });
  await stagedVideo('marksman-stuck-obstacle-ab.webm', panels, {
    region: [560, 90, 480, 720], zoom: 0.6, frames: 330, cols: 3,
    rowTitles: ['EARLY CONSOLE (70x70, 90px ahead) — contact ~0.3s, inside the first window', 'COVER HEAD-ON (90x90, 270px ahead) — contact ~1.9-2.6s, after it'],
    foot: (st) => [`contact ${st.contact != null ? `${(st.contact / 60).toFixed(2)}s` : '-'} · side ${st.sideMs}ms · to player ${st.d ?? '-'}px`],
    label: (f) => `1x — Regular Marksman approaching a standing player 1100px south, seed 1001 (6 seeds, R + E: CSV)  t ${t(f)}s`,
  });
}

// ── D / E. REAL ENCOUNTERS: the diag's encRun script, all three modes ────
async function encounter(file, { q, shared = '', title, ticks = 2400, seed = 1001 }) {
  ticks = +opt('ticks', ticks);
  const pages = [];
  for (const m of ALL) {
    const p = await evPage(m, { q, shared, seed });
    await p.evaluate(({ seed, SEG }) => {
      const gs = window.__gs, P = gs.player, A = window.__aud;
      window.game.scene.getScene('HUD')?.scene.setVisible(false);
      gs.cameraDirector.update = () => {};
      window.__seed(seed); window.__draws = 0; A.tick = 0; A.trace.length = 0;
      window.__tr = [];
      window.__place(800, 700, 0.4);
      let i = 0;
      window.__encStep = (per) => {
        // exactly encRun's script: keys per segment, fire every 7 ticks from 1s, Supers at 15s and 28.3s
        for (let k = 0; k < per; k++, i++) {
          const cur = SEG.find(([a, b]) => i >= a && i < b)[2], K = gs.keys;
          K.A.isDown = cur.includes('A'); K.D.isDown = cur.includes('D'); K.W.isDown = cur.includes('W'); K.S.isDown = cur.includes('S');
          if (i >= 60 && i % 7 === 0) P.keyboardFire();
          if (i === 900 || i === 1700) { P.superCharge = 999; P.tryFireSuper(P._autoAimAngle()); }
          window.__adv(1);
        }
        // the impact camera punch sets zoom and tweens it: re-place the
        // FILMING camera every frame, after the step and before the render
        window.__place(800, 700, 0.4);
        window.__draw(); window.__render();
        const mk = gs.enemies.getChildren().filter((e) => e.enemyType === 'sniper' && e.alive && e.active && !e._miniBoss);
        return { t: i / 60, ss: window.__stats(), alive: gs.enemies.getChildren().filter((e) => e.alive && e.active).length, mkAlive: mk.length, charging: mk.filter((e) => e._charging).length };
      };
      window.__draw(); window.__render();
    }, { seed, SEG: ENC_SEG });
    pages.push(p);
  }
  const clip = await pages[0].evaluate(() => window.__clipFor(0, 0, 1600, 1400));
  const vw = videoWriter(OUT + file);
  const lab = 26, ft = 40, gap = 8, W = 3 * clip.width + 2 * gap, H = clip.height + lab + ft + 24;
  let last;
  for (let f = 0; f < ticks / 2; f++) {
    const shots = [];
    for (const p of pages) shots.push({ st: await p.evaluate(() => window.__encStep(2)), buf: await p.screenshot({ clip }) });
    const draws = [], texts = [];
    ALL.forEach((m, j) => {
      const x = j * (clip.width + gap), st = shots[j].st;
      draws.push({ i: j, sx: 0, sy: 0, sw: clip.width, sh: clip.height, dx: x, dy: lab });
      texts.push({ text: MODE[m].title, x: x + 6, y: 18, size: 13, bold: true, color: MODE[m].color });
      texts.push({ text: `Marksman sidesteps taken ${st.ss.taken} (false-first ${st.ss.takenF1} · hold ${st.ss.takenHold} · contact ${st.ss.takenBlock}) · stood ${st.ss.stood} · B ${st.ss.bArms}`, x: x + 6, y: lab + clip.height + 16, size: 11, color: MODE[m].color });
      texts.push({ text: `Marksman sidestep time ${st.ss.sideMs}ms · Marksmen alive ${st.mkAlive} (charging ${st.charging}) · enemies ${st.alive}`, x: x + 6, y: lab + clip.height + 32, size: 11, color: '#cfd6e4' });
    });
    texts.push({ text: `${title} — real spawner, AI live, 1x, seed ${seed}, the metrics' scripted player.  t ${shots[0].st.t.toFixed(1)}s`, x: 8, y: H - 8, size: 12, color: '#ffd9a0' });
    await vw.write(await composite(shots.map((s) => s.buf), { W, H, draws, texts }));
    last = shots.map((s) => s.st.ss);
  }
  await vw.end();
  // the film must BE the measured runtime: the same encounter, seed and
  // script through the metrics' own `encRun`, compared tick for tick
  for (let j = 0; j < ALL.length; j++) {
    const got = await pages[j].evaluate(() => window.__tr);
    await pages[j].close();
    const p = await bootPage(browser, { q, flags: [shared, MODE[ALL[j]].flags].filter(Boolean).join('&'), seed });
    await installAudit(p, 'A');
    const ref = (await encRun(p, { seed, ticks })).trace;
    await p.close();
    verify(file, ALL[j], got, ref);
  }
  console.log('wrote', OUT + file, JSON.stringify(last));
}
const nest = () => encounter('marksman-stuck-sniper-nest.webm', { q: 'encdbg=sniperNest&room=detention&sector=8&wave=2', title: 'SNIPER NEST (detention, sector 8, wave 2)' });
const mixed = () => encounter('marksman-stuck-mixed.webm', { q: 'encdbg=mixed&room=detention&sector=12&wave=2', shared: 'bulwarkStuck=early', title: 'MIXED (detention, sector 12, wave 2) — ?bulwarkStuck=early on in ALL three' });

const steps = { clear, hold, obstacle, nest, mixed };
const todo = ARGS.length ? ARGS : Object.keys(steps);
for (const s of todo) { if (!steps[s]) fail(`unknown step ${s}`); console.log('──', s); await steps[s](); }
await browser.close();
