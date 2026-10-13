// EVIDENCE — PHASE 3B: the ordinary Bulwark's stuck-recovery candidates.
// Writes docs/evidence/bulwark-stuck-v3b/*.webm. Every panel is the live game
// on THIS tree with its REAL URL flag (no flag / ?bulwarkStuck=prog /
// ?bulwarkStuck=early), stepped deterministically (seeded Math.random, a 60Hz
// fixed step) with the Phase 3A observe-only instrument installed. Videos run
// 2 game ticks per 30fps frame — real 1x speed. The AI is never frozen.
//
// THE OVERLAY IS DIAGNOSTIC, drawn by this rig only:
//   trail          the path the body actually ran (spawn dot at its start)
//   RED ring       a base stuck check armed a sidestep and the body TOOK it
//   GREEN ring     the base armed one and the CANDIDATE stood it down
//   BLUE ring      Candidate B armed a check the base declined (body pinned)
//   AMBER ring     armed, never taken (it ran out during a hold)
//   thick red ring + SIDESTEP label   the body is taking a sidestep now
//   VANGUARD: dashed circle = the 200px establish radius, thin = the 140px
//   hold, cyan line = an opener's 60px lane target while it still has one.
//
// usage: node tests/shot-bulwark-stuck.mjs [clear hold obstacle front live] [--live=A|B]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { CHROME, bootPage, installAudit, installStaged } from './diag-stuck-audit.mjs';
import { LIVE_SEG } from './diag-bulwark-stuck.mjs';

const ARGS = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const OUT = new URL('../docs/evidence/bulwark-stuck-v3b/', import.meta.url).pathname;
const FFMPEG = '/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const fail = (m) => { console.error(`FAIL: ${m}`); process.exit(1); };
const b64 = (buf) => `data:image/png;base64,${buf.toString('base64')}`;

const MODE = {
  baseline: { flags: '', title: 'BASELINE — frozen (no flag)', color: '#ff9a8a' },
  A: { flags: 'bulwarkStuck=prog', title: 'CANDIDATE A — ?bulwarkStuck=prog', color: '#9fe0a8' },
  B: { flags: 'bulwarkStuck=early', title: 'CANDIDATE B — ?bulwarkStuck=early', color: '#9fc8ff' },
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
async function evPage(mode, q) {
  const p = await bootPage(browser, { flags: MODE[mode].flags, ...(q ? { q } : {}) });
  await installAudit(p, 'A');
  await installStaged(p);
  await p.evaluate(() => {
    const gs = window.__gs, A = window.__aud;
    window.__headless = false;
    const g = gs.add.graphics().setDepth(9500);
    const T = [];
    const txt = (i) => T[i] || (T[i] = gs.add.text(0, 0, '', { fontFamily: 'monospace', fontSize: '15px', color: '#fff', stroke: '#000', strokeThickness: 4 }).setDepth(9501).setOrigin(0.5, 1));
    const COL = { grunt: 0x9fd8ff, shooter: 0xffd27a, shielded: 0xa8f0b0, sniper: 0xd8a8ff, swarmling: 0xb8ff70, bomber: 0xff9a60, captain: 0x80b0ff };
    const SHORT = { grunt: 'RIFLEMAN', shooter: 'GUNNER', shielded: 'BULWARK', sniper: 'MARKSMAN', swarmling: 'SWARMLING', bomber: 'DEMOLISHER', captain: 'CAPTAIN' };
    window.__ov = { trails: new Map(), front: false };
    // THE CANDIDATE'S OWN DECISIONS, read from its log after every tick
    const snap = new Map();
    const track = () => {
      for (const r of A.recs) {
        const l = r.e._bulwarkStuck?.log; if (!l) continue;
        const s = snap.get(r) || { st: 0, kp: 0, ap: 0 };
        const st = l.stoodF1 + l.stoodHold;
        const last = [...r.checks].reverse().find((c) => c.armed);
        if (st > s.st && last) last.cand = 'stood';
        if (l.keptPinned > s.kp && last) last.cand = 'kept';
        if (l.armedPinned > s.ap) (r.bArms ||= []).push({ x: r.e.x, y: r.e.y, tick: A.tick });
        snap.set(r, { st, kp: l.keptPinned, ap: l.armedPinned });
      }
    };
    const adv = window.__adv;
    window.__adv = (n = 1) => { for (let i = 0; i < n; i++) { adv(1); track(); } };
    window.__quietStaged = () => {
      window.game.scene.getScene('HUD')?.scene.setVisible(false);
      for (const o of gs.roomLayer.getChildren()) if ((o.displayWidth || 0) < 1000 && !o.__audWall) o.setVisible(false);
      for (const t of gs.terminals || []) { for (const k of Object.values(t)) if (k?.setVisible) k.setVisible(false); t.setVisible?.(false); }
      for (const w of gs.weaponPickups || []) { w.setVisible?.(false); for (const k of Object.values(w)) if (k?.setVisible) k.setVisible(false); }
      for (const q of gs.envLight?.parts || []) (q.img || q.image || q)?.setVisible?.(false);
      gs.cameraDirector.update = () => {};
    };
    window.__render = () => { const gm = window.game; gm.renderer.preRender(); gm.scene.render(gm.renderer); gm.renderer.postRender(); };
    window.__place = (cx, cy, zoom) => { const cam = gs.cameras.main; cam.setZoom(zoom); cam.centerOn(cx, cy); };
    window.__clipFor = (x0, y0, w, h) => {
      const cam = gs.cameras.main, wv = cam.worldView, z = cam.zoom;
      return { x: Math.round(cam.x + (x0 - wv.x) * z), y: Math.round(cam.y + (y0 - wv.y) * z), width: Math.round(w * z), height: Math.round(h * z) };
    };
    const dashCircle = (x, y, R, col, a, w) => {
      g.lineStyle(w, col, a);
      for (let k = 0; k < 48; k += 2) g.beginPath(), g.arc(x, y, R, k / 48 * Math.PI * 2, (k + 1) / 48 * Math.PI * 2), g.strokePath();
    };
    window.__draw = () => {
      const P = gs.player, f = gs._vanguardFront;
      g.clear();
      if (window.__ov.front && f && !f.released) {
        dashCircle(P.x, P.y, f.cfg.establishPx, 0xffffff, 0.75, 3);
        g.lineStyle(2, 0xffffff, 0.3); g.strokeCircle(P.x, P.y, 140);
      }
      let k = 0;
      for (const r of A.recs) {
        const e = r.e;
        let tr = window.__ov.trails.get(r);
        if (!tr) { tr = [[r.sx, r.sy]]; window.__ov.trails.set(r, tr); }
        if (e.active) tr.push([e.x, e.y]);
        const col = COL[r.type] || 0xffffff;
        g.lineStyle(3, col, 0.95); g.beginPath(); g.moveTo(tr[0][0], tr[0][1]); for (const [x, y] of tr) g.lineTo(x, y); g.strokePath();
        g.fillStyle(col, 1); g.fillCircle(r.sx, r.sy, 5);
        for (const c of r.checks) if (c.armed) {
          const ringCol = c.cand === 'stood' ? 0x60ff90 : c.cons > 0 ? 0xff3030 : 0xffb030;
          g.lineStyle(c.cons > 0 || c.cand ? 3 : 2, ringCol, 1); g.strokeCircle(c.x, c.y, 18);
        }
        for (const b of r.bArms || []) { g.lineStyle(3, 0x50a0ff, 1); g.strokeCircle(b.x, b.y, 24); }
        if (window.__ov.front && e._lane && e.alive && e.active && f && !f.released) {
          const dx = P.x - e.x, dy = P.y - e.y, dist = Math.hypot(dx, dy) || 1, kk = e._lane.sign * e._lane.px / dist;
          g.lineStyle(2, 0x40e0ff, 0.8); g.lineBetween(e.x, e.y, P.x - dy * kk, P.y + dx * kk);
          g.fillStyle(0x40e0ff, 0.9); g.fillCircle(P.x - dy * kk, P.y + dx * kk, 6);
        }
        const taking = e.active && e.alive && r.pbr === 2 && e._stuckSidestepMs > 0;
        if (taking) { g.lineStyle(4, 0xff3030, 1); g.strokeCircle(e.x, e.y, (e.displayHeight || 60) * 0.55); }
        if (e.active && e.alive) {
          const t = txt(k++);
          const op = f?.pair?.indexOf(e);
          const name = op >= 0 ? `OPENER ${op + 1}` : r.type === 'shielded' ? `${r.elite ? 'ELITE ' : ''}${r.screen ? 'SCREEN ' : ''}BULWARK` : (SHORT[r.type] || r.type);
          const cls = taking ? (r.open?.cls || r.popen?.cls || (r.bArms?.length ? 'PINNED (B)' : '')) : '';
          t.setText(`${e.__audLabel || name}${taking ? `\nSIDESTEP ${cls}` : ''}`);
          t.setColor(taking ? '#ff6a5a' : '#ffffff').setPosition(e.x, e.y - (e.displayHeight || 60) * 0.55 - 4).setVisible(true).setScale(1 / gs.cameras.main.zoom * 0.8);
        }
      }
      for (let i = k; i < T.length; i++) T[i].setVisible(false);
      gs._sectorTint?.setAlpha(0);
    };
    // per-panel counts for the caption
    window.__stats = () => {
      const s = { taken: 0, takenF1: 0, takenHold: 0, takenBlock: 0, stood: 0, bArms: 0, sideMs: 0 };
      for (const r of A.recs) {
        if (r.type !== 'shielded' || r.nem) continue;
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

// ── staged videos: N pages in lockstep ───────────────────────────────────
async function stagedVideo(file, panels, { region, zoom, frames, per = 2, label, cols = panels.length, foot = (st) => '' }) {
  const pages = [];
  for (const pn of panels) {
    const p = await evPage(pn.mode);
    await p.evaluate(async ({ sc, region, zoom }) => {
      await window.__audSetup(sc);
      window.__quietStaged(); window.__ov.trails.clear();
      window.__place(region[0] + region[2] / 2, region[1] + region[3] / 2, zoom);
      window.__draw(); window.__render();
    }, { sc: pn.sc, region, zoom });
    pages.push(p);
  }
  const clip = await pages[0].evaluate((r) => window.__clipFor(...r), region);
  const vw = videoWriter(OUT + file);
  const lab = 26, ft = 38, gap = 8, rows = Math.ceil(panels.length / cols);
  const W = cols * clip.width + (cols - 1) * gap, H = rows * (clip.height + lab + ft) + 46;
  let last;
  for (let f = 0; f < frames; f++) {
    const shots = [];
    for (const p of pages) {
      const st = await p.evaluate((per) => {
        for (let i = 0; i < per; i++) window.__audStep();
        window.__draw(); window.__render();
        const r = window.__aud.recs[0], e = r?.e, P = window.__gs.player;
        return { ...window.__stats(), d: e ? Math.round(Math.hypot(P.x - e.x, P.y - e.y)) : null, engage: r?.engage, contact: r?.firstContact };
      }, per);
      shots.push({ buf: await p.screenshot({ clip }), st });
    }
    const draws = [], texts = [];
    panels.forEach((pn, j) => {
      const x = (j % cols) * (clip.width + gap), y = Math.floor(j / cols) * (clip.height + lab + ft);
      draws.push({ i: j, sx: 0, sy: 0, sw: clip.width, sh: clip.height, dx: x, dy: y + lab });
      texts.push({ text: pn.title, x: x + 6, y: y + 18, size: 13, bold: true, color: MODE[pn.mode].color });
      const st = shots[j].st;
      texts.push({ text: `taken ${st.taken} (F1 ${st.takenF1}·hold ${st.takenHold}·contact ${st.takenBlock}) stood ${st.stood} B ${st.bArms}`, x: x + 6, y: y + lab + clip.height + 15, size: 11, color: MODE[pn.mode].color });
      texts.push({ text: foot(st, pn), x: x + 6, y: y + lab + clip.height + 31, size: 11, color: '#cfd6e4' });
    });
    texts.push({ text: label(f), x: 8, y: H - 24, size: 12, color: '#ffd9a0' });
    texts.push({ text: LEGEND, x: 8, y: H - 7, size: 11, color: '#cfd6e4' });
    await vw.write(await composite(shots.map((s) => s.buf), { W, H, draws, texts }));
    last = shots.map((s) => s.st);
  }
  await vw.end();
  for (const p of pages) { await p.evaluate(() => window.__audCollect()); await p.close(); }
  console.log('wrote', OUT + file, JSON.stringify(last));
}
const t = (f, per = 2) => (f * per / 60).toFixed(1);
const LEGEND = 'rings: RED armed + taken · GREEN stood down by the candidate · BLUE armed by B (pinned) · AMBER armed, ran out unused   (overlay = rig only)';
const engagedTxt = (st) => `${st.engage != null ? `ENGAGED ${(st.engage / 60).toFixed(2)}s` : `to player ${st.d ?? '-'}px`}${st.contact != null ? ` · contact ${(st.contact / 60).toFixed(2)}s` : ''} · side ${st.sideMs}ms`;

// ── 1. CLEAR LANE: free Regular, free Elite, VANGUARD screen ─────────────
async function clear() {
  const sc = { seed: 1001, ticks: 99999, player: { path: 'stand', x: 800, y: 1150 }, actors: [
    { type: 'shielded', x: 520, y: 220, at: 0, label: 'BULWARK' }, { type: 'shielded', elite: true, x: 800, y: 220, at: 0, label: 'ELITE' },
    { type: 'shielded', spec: { vanguardScreen: { holdPx: 140, resumePx: 165 } }, x: 1080, y: 220, at: 0, label: 'SCREEN' }] };
  await stagedVideo('bulwark-stuck-clear-ab.webm', ['baseline', 'A', 'B'].map((m) => ({ mode: m, title: MODE[m].title, sc })), {
    region: [380, 150, 840, 1060], zoom: 0.4, frames: 270,
    foot: (st) => `sidestep time, all three Bulwarks: ${st.sideMs}ms`,
    label: (f) => `1x real speed — same seed, empty lane, standing player. The base stuck check runs 0.60s after spawning.  t ${t(f)}s`,
  });
}

// ── 2. HOLD -> RESUME: the player stands 4s, then backs off twice ────────
async function hold() {
  const sc = { seed: 1001, ticks: 99999, player: { path: 'away', x: 800, y: 650 }, actors: [
    { type: 'shielded', x: 680, y: 200, at: 0, label: 'BULWARK' }, { type: 'shielded', spec: { vanguardScreen: { holdPx: 140, resumePx: 165 } }, x: 920, y: 200, at: 0, label: 'SCREEN' }] };
  await stagedVideo('bulwark-stuck-hold-resume.webm', ['baseline', 'A', 'B'].map((m) => ({ mode: m, title: MODE[m].title, sc })), {
    region: [480, 120, 640, 1260], zoom: 0.42, frames: 360,
    foot: (st) => `sidestep time: ${st.sideMs}ms`,
    label: (f) => `1x — a free Bulwark (holds at 290px) and a VANGUARD screen (holds at 140, resumes past 165). Player stands 4s, backs off at 4.0s and 8.0s.  t ${t(f)}s`,
  });
}

// ── 3. OBSTACLES: met before the first check (top) and after it (bottom) ─
async function obstacle() {
  const near = { seed: 1001, ticks: 99999, player: { path: 'stand', x: 800, y: 1150 }, wall: [800, 390, 240, 40], actors: [{ type: 'shielded', x: 800, y: 250, at: 0, label: 'BULWARK' }] };
  const far = { ...near, wall: [800, 700, 240, 40] };
  const panels = [];
  for (const [sc, tag] of [[near, 'EARLY wall (met ~0.6s)'], [far, 'LATER wall (met ~2.8-3.5s)']]) for (const m of ['baseline', 'A', 'B']) panels.push({ mode: m, title: `${m === 'baseline' ? 'BASELINE' : `CANDIDATE ${m}`} · ${tag}`, sc });
  await stagedVideo('bulwark-stuck-obstacle-ab.webm', panels, {
    region: [560, 160, 480, 1060], zoom: 0.36, frames: 390, cols: 3,
    foot: (st) => engagedTxt(st),
    label: (f) => `1x — a 240x40 wall dead on the lane, seed 1001 (the 8-seed matrix is in the CSV). Elapsed  t ${t(f)}s`,
  });
}

// ── 4. VANGUARD FRONT (priority): the real opening, player at the east gates
async function front() {
  const modes = ['baseline', 'A', 'B'];
  const pages = [];
  for (const m of modes) {
    const p = await evPage(m, 'encdbg=vanguard&room=hangar&sector=8&wave=2');
    await p.evaluate(() => {
      const gs = window.__gs, P = gs.player, A = window.__aud;
      window.__seed(1001); window.__draws = 0; A.tick = 0;
      window.game.scene.getScene('HUD')?.scene.setVisible(false);
      gs.cameraDirector.update = () => {};
      window.__ov.front = true;
      window.__place(1150, 650, 0.62);
      let i = 0; const iso = [0, 0]; let rel = null;
      window.__frontStep = (per) => {
        for (let k = 0; k < per; k++, i++) {
          P.setPosition(1150, 700); P.body.reset(1150, 700);
          window.__adv(1);
          const f = gs._vanguardFront;
          if (f && !f.released) {
            const near = f.pair.map((e) => !!(e?.alive && e.active && Math.hypot(e.x - P.x, e.y - P.y) <= f.cfg.establishPx));
            if (near[0] && !near[1]) iso[0]++; if (near[1] && !near[0]) iso[1]++;
          }
          if (f?.released && !rel) rel = { t: i / 60, why: f.why, pos: f.pair.map((e) => e && { x: Math.round(e.x), y: Math.round(e.y), d: Math.round(Math.hypot(e.x - P.x, e.y - P.y)) }), since: f.sinceSecondMs };
        }
        window.__draw(); window.__render();
        const f = gs._vanguardFront;
        const d = (f?.pair || []).map((e) => (e?.alive ? Math.round(Math.hypot(e.x - P.x, e.y - P.y)) : null));
        return { t: i / 60, held: f && !f.released, second: f?.secondAt != null, sinceSecond: f ? Math.round(f.sinceSecondMs) : 0, d, iso: iso.map((n) => Math.round(n * 1000 / 60)), rel, ss: window.__stats() };
      };
      window.__draw(); window.__render();
    });
    pages.push(p);
  }
  const region = [760, 120, 780, 1080];
  const clip = await pages[0].evaluate((r) => window.__clipFor(...r), region);
  const vw = videoWriter(OUT + 'bulwark-stuck-vanguard-front.webm');
  const lab = 26, ft = 80, gap = 8, W = 3 * clip.width + 2 * gap, H = clip.height + lab + ft + 26;
  const frames = 300;
  let last;
  for (let f = 0; f < frames; f++) {
    const shots = [];
    for (const p of pages) shots.push({ st: await p.evaluate(() => window.__frontStep(2)), buf: await p.screenshot({ clip }) });
    const draws = [], texts = [];
    modes.forEach((m, j) => {
      const x = j * (clip.width + gap), st = shots[j].st;
      draws.push({ i: j, sx: 0, sy: 0, sw: clip.width, sh: clip.height, dx: x, dy: lab });
      texts.push({ text: MODE[m].title, x: x + 6, y: 18, size: 13, bold: true, color: MODE[m].color });
      const y0 = lab + clip.height + 15;
      const status = st.rel ? `RELEASED ${st.rel.why.toUpperCase()} ${st.rel.t.toFixed(2)}s (+${Math.round(st.rel.since)}ms)` : st.held ? (st.second ? `HOLDING ${(st.sinceSecond / 1000).toFixed(2)} / 3.00s timeout` : 'HOLDING — opening events') : 'front: none yet';
      texts.push({ text: status, x: x + 6, y: y0, size: 12, bold: true, color: st.rel ? (st.rel.why === 'established' ? '#9fe0a8' : '#ffb070') : '#ffffff' });
      const pos = st.rel ? st.rel.pos.map((q, k) => (q ? `op${k + 1} (${q.x},${q.y}) ${q.d}px` : `op${k + 1} -`)).join(' · ') : st.d.map((dd, k) => `op${k + 1} ${dd ?? '-'}px`).join(' · ');
      texts.push({ text: `${st.rel ? 'at release: ' : 'now: '}${pos}`, x: x + 6, y: y0 + 16, size: 11, color: '#cfd6e4' });
      texts.push({ text: `alone in 200px: op1 ${st.iso[0]}ms · op2 ${st.iso[1]}ms`, x: x + 6, y: y0 + 32, size: 11, color: '#cfd6e4' });
      texts.push({ text: `taken ${st.ss.taken} (F1 ${st.ss.takenF1}·hold ${st.ss.takenHold}) stood ${st.ss.stood}`, x: x + 6, y: y0 + 48, size: 11, color: MODE[m].color });
    });
    texts.push({ text: `VANGUARD + Captain (hangar, sector 8, wave 2), the real spawner and front, seed 1001 — 1x. Player held at the east gates (1150,700).  t ${shots[0].st.t.toFixed(1)}s`, x: 8, y: H - 8, size: 12, color: '#ffd9a0' });
    await vw.write(await composite(shots.map((s) => s.buf), { W, H, draws, texts }));
    last = shots.map((s) => ({ rel: s.st.rel, iso: s.st.iso, ss: s.st.ss }));
  }
  await vw.end();
  console.log('wrote', OUT + 'bulwark-stuck-vanguard-front.webm', JSON.stringify(last));
  for (const p of pages) await p.close();
}

// ── 5. LIVE VANGUARD + Captain: best candidate vs baseline, 1x ───────────
async function live() {
  const cand = opt('live', 'B');
  const modes = ['baseline', cand];
  const pages = [];
  for (const m of modes) {
    const p = await evPage(m, 'encdbg=vanguard&room=hangar&sector=8&wave=2');
    await p.evaluate((SEG) => {
      const gs = window.__gs, P = gs.player, A = window.__aud;
      window.__seed(1001); window.__draws = 0; A.tick = 0;
      window.game.scene.getScene('HUD')?.scene.setVisible(false);
      gs.cameraDirector.update = () => {};
      window.__place(800, 700, 0.4);
      let i = 0, rel = null;
      const PH = [[0, 120, 'standing'], [120, 250, 'APPROACHING'], [250, 400, 'HOLDING'], [400, 500, 'FLANKING north'], [500, 620, 'CROSSING BEHIND (east)'], [620, 760, 'crossing south'],
        [760, 880, 'RETREATING'], [880, 1000, 'HOLDING'], [1000, 1120, 'APPROACHING'], [1120, 1240, 'FLANKING south-east'], [1240, 1380, 'RETREATING'], [1380, 1500, 'flanking north'],
        [1500, 1640, 'HOLDING'], [1640, 1760, 'APPROACHING'], [1760, 1900, 'RETREATING'], [1900, 2040, 'crossing south'], [2040, 2160, 'approaching'], [2160, 99999, 'holding']];
      window.__liveStep = (per) => {
        for (let k = 0; k < per; k++, i++) {
          const cur = SEG.find(([a, b]) => i >= a && i < b)[2], K = gs.keys;
          K.A.isDown = cur.includes('A'); K.D.isDown = cur.includes('D'); K.W.isDown = cur.includes('W'); K.S.isDown = cur.includes('S');
          if (i >= 60 && i % 7 === 0) P.keyboardFire();
          if (i === 900 || i === 1700) { P.superCharge = 999; P.tryFireSuper(P._autoAimAngle()); }
          window.__adv(1);
        }
        window.__draw(); window.__render();
        const f = gs._vanguardFront;
        if (f?.released && !rel) rel = `front ${f.why.toUpperCase()} at ${(i / 60).toFixed(1)}s`;
        return { t: i / 60, front: rel || (f ? 'front holding' : 'no front'), phase: PH.find(([a, b]) => i >= a && i < b)[2], ss: window.__stats(), alive: gs.enemies.getChildren().filter((e) => e.alive && e.active).length };
      };
      window.__draw(); window.__render();
    }, LIVE_SEG);
    pages.push(p);
  }
  const clip = await pages[0].evaluate(() => window.__clipFor(0, 0, 1600, 1400));
  const vw = videoWriter(OUT + 'bulwark-stuck-vanguard-live.webm');
  const lab = 26, ft = 40, gap = 8, W = 2 * clip.width + gap, H = clip.height + lab + ft + 24;
  let last;
  for (let f = 0; f < 1080; f++) {
    const shots = [];
    for (const p of pages) shots.push({ st: await p.evaluate(() => window.__liveStep(2)), buf: await p.screenshot({ clip }) });
    const draws = [], texts = [];
    modes.forEach((m, j) => {
      const x = j * (clip.width + gap), st = shots[j].st;
      draws.push({ i: j, sx: 0, sy: 0, sw: clip.width, sh: clip.height, dx: x, dy: lab });
      texts.push({ text: `${MODE[m].title} — ${st.front}`, x: x + 6, y: 18, size: 13, bold: true, color: MODE[m].color });
      texts.push({ text: `Bulwark sidesteps taken ${st.ss.taken} (false-first ${st.ss.takenF1} · hold ${st.ss.takenHold} · contact ${st.ss.takenBlock}) · stood down ${st.ss.stood} · B-armed ${st.ss.bArms}`, x: x + 6, y: lab + clip.height + 16, size: 11, color: MODE[m].color });
      texts.push({ text: `Bulwark sidestep time ${st.ss.sideMs}ms · enemies alive ${st.alive}`, x: x + 6, y: lab + clip.height + 32, size: 11, color: '#cfd6e4' });
    });
    texts.push({ text: `VANGUARD + Captain (hangar, sector 8, wave 2), real spawner, AI live — 1x, seed 1001. Player: ${shots[0].st.phase}.  t ${shots[0].st.t.toFixed(1)}s`, x: 8, y: H - 8, size: 12, color: '#ffd9a0' });
    await vw.write(await composite(shots.map((s) => s.buf), { W, H, draws, texts }));
    last = shots.map((s) => ({ front: s.st.front, ss: s.st.ss }));
  }
  await vw.end();
  console.log('wrote', OUT + 'bulwark-stuck-vanguard-live.webm', JSON.stringify(last));
  for (const p of pages) await p.close();
}

const steps = { clear, hold, obstacle, front, live };
const todo = ARGS.length ? ARGS : Object.keys(steps);
for (const s of todo) { if (!steps[s]) fail(`unknown step ${s}`); console.log('──', s); await steps[s](); }
await browser.close();
