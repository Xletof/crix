// EVIDENCE for the SHARED STUCK-DETECTION AUDIT (Phase 3A). Writes
// docs/evidence/shared-stuck-audit/. Production code is not modified: every
// frame is the live game on THIS tree, stepped deterministically (seeded
// Math.random, a 60Hz fixed step), with the audit's page-side instrument
// (`diag-stuck-audit.mjs`) installed. A counterfactual is that instrument's
// page-side patch, never a source change. Videos run 2 game ticks per 30fps
// frame — real 1x speed — unless a label says slow motion.
//
// The OVERLAY IS DIAGNOSTIC and drawn by this rig only: trails, the red ring
// where a stuck check armed a sidestep, the label on a body while it is taking
// one, and the dashed straight line to the player.
//
// usage: node tests/shot-stuck-audit.mjs [proof lane obstacle v22 vanguard]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { CHROME, bootPage, installAudit, installStaged } from './diag-stuck-audit.mjs';

const ARGS = process.argv.slice(2);
const OUT = new URL('../docs/evidence/shared-stuck-audit/', import.meta.url).pathname;
const FFMPEG = '/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const fail = (m) => { console.error(`FAIL: ${m}`); process.exit(1); };
const b64 = (buf) => `data:image/png;base64,${buf.toString('base64')}`;

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

// ── a rendered, instrumented page with the diagnostic overlay ────────────
async function evPage(variant, { flags = '', q } = {}) {
  const p = await bootPage(browser, { flags, ...(q ? { q } : {}) });
  await installAudit(p, variant);
  await installStaged(p);
  await p.evaluate(() => {
    const gs = window.__gs, A = window.__aud;
    window.__headless = false;
    const g = gs.add.graphics().setDepth(9500);
    const T = [];
    const txt = (i) => T[i] || (T[i] = gs.add.text(0, 0, '', { fontFamily: 'monospace', fontSize: '15px', color: '#fff', stroke: '#000', strokeThickness: 4 }).setDepth(9501).setOrigin(0.5, 1));
    const COL = { grunt: 0x9fd8ff, shooter: 0xffd27a, shielded: 0xa8f0b0, sniper: 0xd8a8ff, swarmling: 0xb8ff70, bomber: 0xff9a60, captain: 0x80b0ff };
    const SHORT = { grunt: 'RIFLEMAN', shooter: 'GUNNER', shielded: 'BULWARK', sniper: 'MARKSMAN', swarmling: 'SWARMLING', bomber: 'DEMOLISHER', captain: 'CAPTAIN' };
    window.__ov = { trails: new Map(), dashed: true, labels: true, rings: true };
    // a clean frame: no HUD, no props / cover art whose bodies the staged room disabled
    window.__quietStaged = () => {
      window.game.scene.getScene('HUD')?.scene.setVisible(false);
      for (const o of gs.roomLayer.getChildren()) if ((o.displayWidth || 0) < 1000 && !o.__audWall) o.setVisible(false);
      for (const t of gs.terminals || []) { for (const k of Object.values(t)) if (k?.setVisible) k.setVisible(false); t.setVisible?.(false); }
      for (const w of gs.weaponPickups || []) { w.setVisible?.(false); for (const k of Object.values(w)) if (k?.setVisible) k.setVisible(false); }
      for (const q of gs.envLight?.parts || []) (q.img || q.image || q)?.setVisible?.(false);
      gs.cameraDirector.update = () => {};
    };
    // the overlay is drawn AFTER the step that rendered the canvas, so repaint
    // the current state once — a render pass only, no update, no gameplay
    window.__render = () => { const gm = window.game; gm.renderer.preRender(); gm.scene.render(gm.renderer); gm.renderer.postRender(); };
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
        const e = r.e;
        let tr = window.__ov.trails.get(r);
        if (!tr) { tr = [[r.sx, r.sy]]; window.__ov.trails.set(r, tr); }
        if (e.active) tr.push([e.x, e.y]);
        const col = COL[r.type] || 0xffffff;
        if (window.__ov.dashed && !r.nem && r.type !== 'captain' && window.__ov.dashedFor?.(r) !== false) {
          const [sx, sy] = [r.sx, r.sy], L = Math.hypot(P.x - sx, P.y - sy);
          g.lineStyle(2, 0xffffff, 0.28);
          for (let d = 0; d < L; d += 24) { const a = d / L, c2 = Math.min(1, (d + 12) / L); g.lineBetween(sx + (P.x - sx) * a, sy + (P.y - sy) * a, sx + (P.x - sx) * c2, sy + (P.y - sy) * c2); }
        }
        g.lineStyle(3, col, 0.95); g.beginPath(); g.moveTo(tr[0][0], tr[0][1]); for (const [x, y] of tr) g.lineTo(x, y); g.strokePath();
        g.fillStyle(col, 1); g.fillCircle(r.sx, r.sy, 5);
        if (window.__ov.rings) for (const c of r.checks) if (c.armed) {
          g.lineStyle(3, c.stood ? 0x60ff90 : 0xff3030, 1); g.strokeCircle(c.x, c.y, 18);
        }
        const taking = e.active && e.alive && r.pbr === 2 && e._stuckSidestepMs > 0;
        if (taking) { g.lineStyle(4, 0xff3030, 1); g.strokeCircle(e.x, e.y, (e.displayHeight || 60) * 0.55); }
        if (window.__ov.labels && e.active && e.alive) {
          const t = txt(k++);
          const cls = taking ? (r.open?.cls || r.popen?.cls || '') : '';
          t.setText(`${r.nem ? 'NEMESIS ' : ''}${e.__audLabel || SHORT[r.type] || r.type}${taking ? `\nSIDESTEP ${cls}` : ''}`);
          t.setColor(taking ? '#ff6a5a' : '#ffffff').setPosition(e.x, e.y - (e.displayHeight || 60) * 0.55 - 4).setVisible(true).setScale(1 / gs.cameras.main.zoom * 0.8);
        }
      }
      for (let i = k; i < T.length; i++) T[i].setVisible(false);
      // (never resetFX here: a camera shake draws random numbers every frame, so
      // clearing it would quietly film a different game from the one measured)
      gs._sectorTint?.setAlpha(0);
    };
    window.__stats = () => {
      const c = { F1: 0, HOLD: 0, BLOCK: 0, OTHER: 0 }, took = { F1: 0, HOLD: 0, BLOCK: 0, OTHER: 0 };
      for (const r of A.recs) for (const ev of r.checks) if (ev.armed && !ev.stood) { const k = { F: 'F1', H: 'HOLD', B: 'BLOCK', O: 'OTHER' }[ev.cls[0]]; c[k]++; if (ev.cons > 0) took[k]++; }
      return { c, took };
    };
  });
  return p;
}
const stagedFrames = async (p, per) => p.evaluate((per) => { for (let i = 0; i < per; i++) window.__audStep(); window.__draw(); window.__render(); }, per);

// ── 1. THE FIRST-CHECK PROOF (still) ─────────────────────────────────────
async function proof() {
  const ROLES = [
    { label: 'RIFLEMAN', type: 'grunt' }, { label: 'GUNNER', type: 'shooter' }, { label: 'BULWARK', type: 'shielded' },
    { label: 'BULWARK · VANGUARD screen', type: 'shielded', spec: { vanguardScreen: { holdPx: 140, resumePx: 165 } } },
    { label: 'MARKSMAN', type: 'sniper' }, { label: 'SWARMLING', type: 'swarmling' },
    { label: 'NEMESIS (Gunner base)', type: 'shooter', nem: true }, { label: 'DEMOLISHER (corrected, reference)', type: 'bomber' },
  ];
  const page = await evPage('A');
  const Z = 0.62, RX = [540, 1060], RY = [200, 760];
  const panels = [];
  for (const role of ROLES) {
    const info = await page.evaluate(async ({ role, Z, RX, RY }) => {
      await window.__audSetup({ seed: 1001, ticks: 80, actors: [{ ...role, label: role.nem ? null : role.label.split(' ')[0], x: 800, y: 250, at: 0 }], player: { path: 'stand', x: 800, y: 1150 } });
      window.__quietStaged(); window.__ov.trails.clear();
      window.__place((RX[0] + RX[1]) / 2, (RY[0] + RY[1]) / 2, Z);
      for (let i = 0; i < 74; i++) { window.__audStep(); window.__draw(); }   // the trail gathers every tick
      window.__render();
      const r = window.__aud.recs[0], f = r.checks.find((c) => c.first);
      return { f, side: r.sideTicks, sidePx: r.sidePath, clip: window.__clipFor(RX[0], RY[0], RX[1] - RX[0], RY[1] - RY[0]), speed: r.speed };
    }, { role, Z, RX, RY });
    const buf = await page.screenshot({ clip: info.clip });
    await page.evaluate(() => window.__audCollect());
    panels.push({ role, info, buf });
  }
  await page.close();
  const pw = panels[0].info.clip.width, ph = panels[0].info.clip.height, tx = 150, gap = 12;
  const W = 4 * pw + 3 * gap + 16, H = 64 + 2 * (ph + tx + gap);
  const draws = [], texts = [{ text: 'THE SHARED FIRST STUCK CHECK — frozen game (04cd882), seed 1001, each body spawned 900px north of a standing player in an empty lane', x: 10, y: 24, size: 16, bold: true, color: '#ffd9a0' },
    { text: 'Dashed: straight line to the player.  Solid: the path actually run, to 1.23s.  Red ring: where the check armed a sidestep.  (Diagnostic overlay, rig only.)', x: 10, y: 46, size: 12, color: '#cfd6e4' }];
  panels.forEach(({ role, info, buf }, j) => {
    const cx = 8 + (j % 4) * (pw + gap), cy = 64 + Math.floor(j / 4) * (ph + tx + gap);
    draws.push({ i: j, sx: 0, sy: 0, sw: pw, sh: ph, dx: cx, dy: cy });
    const f = info.f;
    const L = [
      [role.label, '#ffffff', true],
      [`first check t ${((f.age + 1) / 60).toFixed(2)}s at (${Math.round(f.x)}, ${Math.round(f.y)})`, '#cfd6e4'],
      ['_stuckRefX/Y before it: undefined', '#ffb070'],
      [`base: hypot(x - (ref ?? x)) = ${f.baseMoved}px`, '#ffb070'],
      [`really moved from spawn: ${Math.round(f.trueMoved)}px`, '#cfd6e4'],
      [f.armed ? `ARMED: 600ms, dir ${f.dir > 0 ? '+1' : '-1'} (1 random draw)` : 'not armed', f.armed ? '#ff6a5a' : '#9fe0a8', true],
      [f.cons > 0 ? `TAKEN: ${f.cons} ticks, ${Math.round(f.consPx)}px sideways` : (f.armed ? 'NOT TAKEN: vetoed before _moveToward' : ''), f.cons > 0 ? '#ff6a5a' : '#9fe0a8', f.cons === 0],
    ];
    L.forEach(([t, color, bold], i) => texts.push({ text: t, x: cx + 4, y: cy + ph + 18 + i * 19, size: 12, color, bold }));
  });
  const png = await composite(panels.map((p) => p.buf), { W, H, draws, texts, type: 'png' });
  writeFileSync(OUT + 'stuck-first-check-proof.png', png);
  console.log('wrote', OUT + 'stuck-first-check-proof.png');
  console.log(JSON.stringify(panels.map((p) => [p.role.label, p.info.f.baseMoved, p.info.f.trueMoved, p.info.f.armed, p.info.f.cons, p.info.f.consPx])));
}

// ── staged A/B videos: N pages in lockstep, side by side ─────────────────
async function stagedVideo(file, panels, sc, { region, zoom, frames, per = 2, label, cols = panels.length, slow = null }) {
  const pages = [];
  for (const pn of panels) {
    const p = await evPage(pn.variant, { flags: pn.flags || '' });
    await p.evaluate(async ({ sc, region, zoom }) => {
      await window.__audSetup(sc);
      window.__quietStaged(); window.__ov.trails.clear();
      window.__place(region[0] + region[2] / 2, region[1] + region[3] / 2, zoom);
      window.__draw(); window.__render();   // worldView is only current after a render pass
    }, { sc, region, zoom });
    pages.push(p);
  }
  const clip = await pages[0].evaluate((r) => window.__clipFor(...r), region);
  const vw = videoWriter(OUT + file);
  const lab = 26, foot = 22, gap = 8, rows = Math.ceil(panels.length / cols);
  const W = cols * clip.width + (cols - 1) * gap, H = rows * (clip.height + lab + foot) + 30;
  const kept = [];
  for (let f = 0; f < frames; f++) {
    const shots = [];
    for (const p of pages) {
      await stagedFrames(p, per);
      shots.push({ buf: await p.screenshot({ clip }), st: await p.evaluate(() => window.__stats()) });
    }
    const draws = [], texts = [];
    panels.forEach((pn, j) => {
      const x = (j % cols) * (clip.width + gap), y = Math.floor(j / cols) * (clip.height + lab + foot);
      draws.push({ i: j, sx: 0, sy: 0, sw: clip.width, sh: clip.height, dx: x, dy: y + lab });
      texts.push({ text: pn.title, x: x + 6, y: y + 18, size: 14, bold: true, color: pn.color });
      const st = shots[j].st;
      const narrow = clip.width < 400;
      texts.push({ text: narrow ? `taken F1 ${st.took.F1} · hold ${st.took.HOLD} · contact ${st.took.BLOCK} · other ${st.took.OTHER}`
        : `taken: false-first ${st.took.F1} · hold ${st.took.HOLD} · contact ${st.took.BLOCK} · other ${st.took.OTHER}`, x: x + 6, y: y + lab + clip.height + 16, size: 11, color: pn.color });
    });
    texts.push({ text: label(f), x: 8, y: H - 9, size: 13, color: '#ffd9a0' });
    const jpg = await composite(shots.map((s) => s.buf), { W, H, draws, texts });
    await vw.write(jpg);
    if (slow && f >= slow[0] && f < slow[1]) kept.push(jpg);
  }
  if (slow) for (const jpg of kept) for (let r = 0; r < slow[2]; r++) await vw.write(jpg);
  await vw.end();
  const stats = [];
  for (const p of pages) { stats.push(await p.evaluate(() => window.__stats())); await p.evaluate(() => window.__audCollect()); await p.close(); }
  console.log('wrote', OUT + file, JSON.stringify(stats));
}

const FROZEN = { variant: 'A', title: 'FROZEN GAME (04cd882) — the shipped check', color: '#ff9a8a' };
const VETO = { variant: 'veto', title: 'COUNTERFACTUAL — first check re-measured from spawn (rig only)', color: '#9fe0a8' };

// ── 2. CLEAR LANE A/B ────────────────────────────────────────────────────
async function lane() {
  const sc = { seed: 1001, ticks: 99999, player: { path: 'stand', x: 800, y: 1150 }, actors: [
    { type: 'grunt', x: 300, y: 200, at: 0 }, { type: 'shooter', x: 550, y: 200, at: 0 }, { type: 'shielded', x: 800, y: 200, at: 0 },
    { type: 'sniper', x: 1050, y: 200, at: 0 }, { type: 'swarmling', x: 1300, y: 200, at: 0 }] };
  await stagedVideo('stuck-clear-lane-ab.webm', [FROZEN, VETO], sc, {
    region: [150, 140, 1300, 1080], zoom: 0.5, frames: 140,
    label: (f) => `1x real speed — same seed, same room, same staging; an empty lane, a standing player. The stuck check runs 0.60s after spawning.  t ${(f * 2 / 60).toFixed(2)}s  (a 3x slow repeat of 0.4-1.5s follows)`,
    slow: [12, 44, 3],
  });
}

// ── 3. GENUINE OBSTRUCTION: frozen / counterfactual / no recovery at all ─
async function obstacle() {
  // A body only PINS when it meets a face nearly head-on: Arcade separates on
  // one axis, so a diagonal approach slides off a box corner by itself. Three
  // roles therefore walk almost straight down into one wall segment.
  const sc = { seed: 1001, ticks: 99999, player: { path: 'stand', x: 800, y: 1150 },
    wall: [800, 640, 240, 40],
    actors: [{ type: 'grunt', x: 720, y: 200, at: 0 }, { type: 'shooter', x: 800, y: 200, at: 0 }, { type: 'shielded', x: 880, y: 200, at: 0 }] };
  const OFF = { variant: 'off', title: 'CONTROL — recovery OFF (rig only)', color: '#a8c8ff' };
  await stagedVideo('stuck-obstacle-ab.webm', [{ ...FROZEN, title: 'FROZEN GAME (04cd882)' }, { ...VETO, title: 'COUNTERFACTUAL — first check fixed' }, OFF], sc, {
    region: [440, 150, 720, 1080], zoom: 0.45, frames: 300,
    label: (f) => `1x — a real wall (240x40) across three lanes. Recovery must fire on contact: switched off (right), nobody gets round.  t ${(f * 2 / 60).toFixed(1)}s`,
  });
}

// ── 4. MOVEMENT v2 / v2.2 ────────────────────────────────────────────────
async function v22() {
  const sc = { seed: 8920, ticks: 99999, player: { path: 'away', x: 800, y: 800 }, actors: [
    { type: 'shooter', x: 650, y: 220, at: 0 }, { type: 'grunt', x: 950, y: 220, at: 0 }] };
  const P = [];
  for (const [flags, name] of [['', 'DEFAULT'], ['move=v2', 'move=v2'], ['move=v22', 'move=v22']]) {
    P.push({ variant: 'A', flags, title: `${name} · FROZEN`, color: '#ff9a8a' });
    P.push({ variant: 'veto', flags, title: `${name} · fixed (rig)`, color: '#9fe0a8' });
  }
  await stagedVideo('stuck-movement-v22-ab.webm', P, sc, {
    region: [380, 160, 840, 1220], zoom: 0.36, frames: 330, cols: 2,
    label: (f) => `1x — Gunner + Rifleman. Player stands 4s, then backs off twice.  t ${(f * 2 / 60).toFixed(1)}s`,
  });
}

// ── 5. LIVE VANGUARD: the real encounter, frozen game vs counterfactual ──
// The real VANGUARD + Captain cell (hangar, sector 8, wave 2) with the real
// spawner, queue and front. The player stands near the east gates — the one
// measured geometry where the opening front can ESTABLISH inside its 3s
// timeout — and holds still until it releases, then backs off and fires
// (hold -> resume). A placed camera shows the whole hangar.
async function vanguard() {
  const SEG = [[0, 330, ''], [330, 380, 'S'], [380, 520, ''], [520, 570, 'A'], [570, 700, ''], [700, 750, 'S'], [750, 900, ''], [900, 950, 'W'], [950, 1100, ''], [1100, 1150, 'D'], [1150, 99999, '']];
  const panels = [{ variant: 'A', title: 'FROZEN GAME (04cd882)', color: '#ff9a8a' }, { variant: 'veto', title: 'COUNTERFACTUAL — first check fixed (rig only)', color: '#9fe0a8' }];
  const pages = [];
  for (const pn of panels) {
    const p = await evPage(pn.variant, { q: 'encdbg=vanguard&room=hangar&sector=8&wave=2' });
    await p.evaluate((SEG) => {
      const gs = window.__gs, P = gs.player, A = window.__aud;
      window.__seed(1001); window.__draws = 0; A.tick = 0;
      window.game.scene.getScene('HUD')?.scene.setVisible(false);
      gs.cameraDirector.update = () => {};
      window.__place(800, 700, 0.4);
      P.setPosition(1150, 700); P.body.reset(1150, 700);
      window.__ov.dashed = false;
      let i = 0;
      window.__encStep = (per) => {
        for (let k = 0; k < per; k++, i++) {
          const cur = SEG.find(([a, b]) => i >= a && i < b)[2], K = gs.keys;
          K.A.isDown = cur.includes('A'); K.D.isDown = cur.includes('D'); K.W.isDown = cur.includes('W'); K.S.isDown = cur.includes('S');
          if (i >= 330 && i % 9 === 0) P.keyboardFire();
          if (i === 1000) { P.superCharge = 999; P.tryFireSuper(P._autoAimAngle()); }
          window.__adv(1);
        }
        window.__draw(); window.__render();
        const f = gs._vanguardFront;
        if (f?.released && window.__frontAt == null) window.__frontAt = i / 60;
        const front = f ? (f.released ? `front ${f.why.toUpperCase()} at ${window.__frontAt.toFixed(1)}s` : 'front holding') : 'no front';
        return { front, t: i / 60 };
      };
      window.__draw(); window.__render();
    }, SEG);
    pages.push(p);
  }
  const clip = await pages[0].evaluate(() => window.__clipFor(0, 0, 1600, 1400));
  const vw = videoWriter(OUT + 'stuck-vanguard-live.webm');
  const lab = 26, foot = 40, gap = 8, W = 2 * clip.width + gap, H = clip.height + lab + foot + 24;
  let last = [];
  for (let f = 0; f < 720; f++) {
    const shots = [];
    for (const p of pages) shots.push({ st: await p.evaluate(() => ({ ...window.__encStep(2), ss: window.__stats() })), buf: await p.screenshot({ clip }) });
    const draws = [], texts = [];
    panels.forEach((pn, j) => {
      const x = j * (clip.width + gap), st = shots[j].st;
      draws.push({ i: j, sx: 0, sy: 0, sw: clip.width, sh: clip.height, dx: x, dy: lab });
      texts.push({ text: `${pn.title} — ${st.front}`, x: x + 6, y: 18, size: 13, bold: true, color: pn.color });
      texts.push({ text: `taken: false-first ${st.ss.took.F1} · hold→resume ${st.ss.took.HOLD} · contact ${st.ss.took.BLOCK} · other ${st.ss.took.OTHER}`, x: x + 6, y: lab + clip.height + 16, size: 12, color: pn.color });
      texts.push({ text: `armed: ${st.ss.c.F1} / ${st.ss.c.HOLD} / ${st.ss.c.BLOCK} / ${st.ss.c.OTHER}`, x: x + 6, y: lab + clip.height + 33, size: 11, color: '#cfd6e4' });
    });
    texts.push({ text: `VANGUARD + Captain (hangar, sector 8, wave 2), the real spawner and front — 1x. Player stands near the east gates until the front releases, then backs off and fires.  t ${shots[0].st.t.toFixed(1)}s`, x: 8, y: H - 8, size: 12, color: '#ffd9a0' });
    await vw.write(await composite(shots.map((s) => s.buf), { W, H, draws, texts }));
    last = shots.map((s) => s.st);
  }
  await vw.end();
  console.log('wrote', OUT + 'stuck-vanguard-live.webm', JSON.stringify(last.map((s) => ({ front: s.front, ...s.ss }))));
  for (const p of pages) await p.close();
}

const steps = { proof, lane, obstacle, v22, vanguard };
const todo = ARGS.length ? ARGS : Object.keys(steps);
for (const s of todo) { if (!steps[s]) fail(`unknown step ${s}`); console.log('──', s); await steps[s](); }
await browser.close();
