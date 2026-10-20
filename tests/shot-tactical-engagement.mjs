// EVIDENCE — PHASE 3C-B: what the Marksman and the Bulwark DECIDE, on film.
// Writes docs/evidence/tactical-engagement-audit/{marksman,bulwark}-passivity.webm
// and mixed-handset-repro.webm. Asserts nothing about behaviour; it FAILS if
// a film is not the measured runtime.
//
// Every panel is the live game on THIS tree with its real URL flags, stepped
// by `diag-tactical-engagement.mjs`'s own `__tac.step` (seeded Math.random, a
// 60Hz fixed step, the observe-only instrument) — the staged cases are its
// `STAGED` table, the encounter is its `runEnc` with the same seed and pilot.
// 2 game ticks per 30fps frame: real 1x speed. The AI is never frozen.
//
// THE FILM IS SIMULATED HEADLESS AND VERIFIED, as in Phase 3C: rendering and
// overlay text draw from `Math.random` (camera shake, the HUD, Phaser Text's
// UUID()), so the shutter render and every overlay draw run on a throwaway
// generator, the game camera is BORROWED for the shutter and put back
// (gameplay reads `worldView`), and after filming each panel is replayed
// headless on a plain page and its per-tick trace (every enemy's position +
// the draw counter) must match tick for tick, or the run fails.
//
// THE OVERLAY IS DIAGNOSTIC, drawn by this rig, read from the instrument's own
// row for the tick (never set):
//   every enemy     a small role tag (GUNNER / RIFLEMAN / MARKSMAN / BULWARK / ...)
//   Marksman, Bulwark
//     line to player  GREEN = `canSee && _hasLOS` this tick; RED = blocked, and
//                     the blocking body outlined in red
//     label           role, the branch its AI took (HOLD / APPROACH / RETREAT /
//                     SCREEN HOLD / SCREEN MOVE), the weapon (CHARGE / WARN /
//                     SHOT) and how long it has stood without a line
//     cyan diamond    the nearest NavGrid-reachable spot in its own band with
//                     a clear line to the player — the instrument's search,
//                     which the AI does NOT run
//
// usage: node tests/shot-tactical-engagement.mjs [marksman bulwark mixed] [--frames=N]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { CHROME } from './diag-stuck-audit.mjs';
import { tacPage, STAGED, VARIANTS, Q, R, BRANCH } from './diag-tactical-engagement.mjs';

const ARGS = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const OUT = opt('out', new URL('../docs/evidence/tactical-engagement-audit/', import.meta.url).pathname);
const FFMPEG = '/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const fail = (m) => { console.error(`FAIL: ${m}`); process.exit(1); };
const b64 = (buf) => `data:image/png;base64,${buf.toString('base64')}`;

const VNAME = { frozen: 'FROZEN (no stuck flag)', mkB: '?marksmanStuck=early', bwB: '?bulwarkStuck=early' };
const VCOL = { frozen: '#ff9a8a', mkB: '#9fc8ff', bwB: '#9fe0a8' };

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
const composite = async (bufs, spec) => Buffer.from((await comp.evaluate(({ srcs, spec }) => window.__comp(srcs, spec), { srcs: bufs.map(b64), spec })).split(',')[1], 'base64');

// ── a filming page: the metrics page + the isolated overlay and shutter ──
async function filmPage(vk, q, seed) {
  const p = await tacPage(browser, VARIANTS[vk], q, seed);
  await p.evaluate(({ R, BRANCH }) => {
    const gs = window.__gs, T = window.__tac, P = gs.player;
    window.game.scene.getScene('HUD')?.scene.setVisible(false);
    let rs = 0x2545f491;
    const renderRng = () => ((rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0) / 4294967296);
    const isolated = (fn) => (...a) => { const keep = Math.random; Math.random = renderRng; try { return fn(...a); } finally { Math.random = keep; } };
    const renderNow = () => { const gm = window.game; gm.renderer.preRender(); gm.scene.render(gm.renderer); gm.renderer.postRender(); };
    window.__film = { cx: 800, cy: 700, zoom: 0.4 };
    const borrow = (fn) => {
      const cam = gs.cameras.main, wv = cam.worldView;
      const keep = { z: cam.zoom, sx: cam.scrollX, sy: cam.scrollY, wx: wv.x, wy: wv.y, ww: wv.width, wh: wv.height, ub: cam.useBounds };
      // the camera's bounds would clamp a filming view back onto the room's
      // centre whenever the view is larger than the room — lifted for the
      // shutter only, and put back with everything else
      cam.useBounds = false;
      cam.setZoom(window.__film.zoom); cam.centerOn(window.__film.cx, window.__film.cy);
      try { return fn(cam); } finally { cam.useBounds = keep.ub; cam.setZoom(keep.z); cam.setScroll(keep.sx, keep.sy); wv.setTo(keep.wx, keep.wy, keep.ww, keep.wh); }
    };
    window.__render = isolated(() => borrow(renderNow));
    window.__clipFor = isolated((x0, y0, w, h) => borrow((cam) => {
      cam.preRender();
      const wv = cam.worldView, z = cam.zoom;
      return { x: Math.round(cam.x + (x0 - wv.x) * z), y: Math.round(cam.y + (y0 - wv.y) * z), width: Math.round(w * z), height: Math.round(h * z) };
    }));
    const G = gs.add.graphics().setDepth(9500);
    const TX = [];
    const txt = (i, size = 15) => TX[i] || (TX[i] = gs.add.text(0, 0, '', { fontFamily: 'monospace', fontSize: `${size}px`, color: '#fff', stroke: '#000', strokeThickness: 4, align: 'center' }).setDepth(9501).setOrigin(0.5, 1));
    const ROLE = { grunt: 'RIFLEMAN', shooter: 'GUNNER', sniper: 'MARKSMAN', shielded: 'BULWARK', bomber: 'DEMOLISHER', swarmling: 'SWARMLING' };
    const passive = new Map();   // actor rec -> ticks standing without a line
    const lastT = new Map();     // actor rec -> the tick its last drawn row was
    window.__draw = isolated(() => {
      G.clear();
      let k = 0;
      const z = window.__film.zoom;
      for (const e of gs.enemies.getChildren()) {
        if (!(e.active && e.alive) || (e.__tac && !e.__tac.ref)) continue;   // Gunner / Rifleman (the diag's controls) get the plain tag
        const t = txt(k++); t.setText(`${e._elite ? 'ELITE ' : ''}${ROLE[e.enemyType] || e.enemyType.toUpperCase()}${e._miniBoss ? ' (NEMESIS)' : ''}`)
          .setColor('#c8ccd6').setPosition(e.x, e.y - (e.displayHeight || 60) * 0.5).setScale(10 / 15 / z).setVisible(true);
      }
      for (const r of T.list) {
        const e = r.e;
        if (r.ref || !(e.active && e.alive)) continue;
        const w = r.rows[r.rows.length - 1];
        if (!w) continue;
        const valid = w[R.see] === 1 && w[R.los] === 1;
        const standing = Math.hypot(w[R.dx], w[R.dy]) < 0.5;
        // in TICKS: a frame advances `per` ticks, so the idle clock reads the
        // row's own tick, never the number of frames drawn
        const dt = w[R.tick] - (lastT.get(r) ?? w[R.tick]);
        lastT.set(r, w[R.tick]);
        const pv = (!valid && standing && !w[R.charging]) ? (passive.get(r) || 0) + dt : 0;
        passive.set(r, pv);
        G.lineStyle(2.2 / z, valid ? 0x50ff80 : 0xff4040, valid ? 0.6 : 0.85);
        G.beginPath(); G.moveTo(e.x, e.y); G.lineTo(P.x, P.y); G.strokePath();
        if (w[R.blocker] >= 0) { const b = gs.losRects[w[R.blocker]]; G.lineStyle(2.5 / z, 0xff4040, 1); G.strokeRect(b.x, b.y, b.width, b.height); }
        if (!valid && r.alt) {
          const a = r.alt, s = 8 / z;
          G.lineStyle(2.5 / z, 0x40e0ff, 1);
          G.beginPath(); G.moveTo(a.x, a.y - s); G.lineTo(a.x + s, a.y); G.lineTo(a.x, a.y + s); G.lineTo(a.x - s, a.y); G.closePath(); G.strokePath();
          // dotted: from the actor to the spot it could have walked to
          const dx = a.x - e.x, dy = a.y - e.y, L = Math.hypot(dx, dy);
          G.fillStyle(0x40e0ff, 0.9);
          for (let u = 12 / z; u < L - s; u += 10 / z) G.fillCircle(e.x + dx / L * u, e.y + dy / L * u, 1.6 / z);
        }
        const role = (r.elite ? 'ELITE ' : '') + (r.type === 'sniper' ? 'MARKSMAN' : r.screen ? 'BULWARK (SCREEN)' : 'BULWARK');
        const br = BRANCH[w[R.branch]].replace('_', ' ');
        const wpn = r.type === 'sniper' ? (e._charging ? (e._chargeMs <= e.cfg.lockMs ? ' · LOCK' : ' · CHARGE') : '') : (e._warnFlashed ? ' · WARN' : '');
        const line = valid ? 'LINE OPEN' : w[R.blocker] >= 0 ? 'LOS BLOCKED' : 'NO SIGHT';
        const side = (e._stuckSidestepMs || 0) > 0 && w[R.cmd] === 2 ? ' · SIDESTEP' : '';
        const t = txt(k++, 15);
        t.setText(`${role}\n${br}${wpn}${side}\n${line}${pv > 30 ? ` · idle ${(pv / 60).toFixed(1)}s` : ''}`)
          .setColor(valid ? '#d8ffe0' : pv > 60 ? '#ff8070' : '#ffffff').setPosition(e.x, e.y - (e.displayHeight || 60) * 0.55 - 4).setScale(12 / 15 / z).setVisible(true);
      }
      for (let i = k; i < TX.length; i++) TX[i].setVisible(false);
      gs._sectorTint?.setAlpha(0);
    });
    window.__summary = () => {
      const o = { mk: 0, mkFire: 0, mkIdle: 0, bw: 0, bwFire: 0, bwIdle: 0, hits: T.hits.length };
      for (const r of T.list) {
        if (r.ref) continue;
        const sn = r.type === 'sniper';
        o[sn ? 'mk' : 'bw']++;
        o[sn ? 'mkFire' : 'bwFire'] += r.shotsN;
        const pv = passive.get(r) || 0;
        if (pv > 60 && r.e.active && r.e.alive) o[sn ? 'mkIdle' : 'bwIdle']++;
      }
      return o;
    };
  }, { R, BRANCH });
  return p;
}

const t = (f, per = 2) => (f * per / 60).toFixed(1);

// ── one film: N panels in lockstep, each its own page ───────────────────
async function film(file, panels, { region, zoom, frames, per = 2, cols = panels.length, caption, note }) {
  frames = +opt('frames', frames);
  const pages = [];
  for (const pn of panels) {
    const p = await filmPage(pn.vk, pn.q, pn.seed);
    await p.evaluate(({ pn, region, zoom }) => {
      // a panel may frame its own centre; the clip SIZE is shared, so the
      // screen-space clip is the same rectangle on every page
      window.__film = pn.center ? { cx: pn.center[0], cy: pn.center[1], zoom } : { cx: region[0] + region[2] / 2, cy: region[1] + region[3] / 2, zoom };
      if (pn.staged) window.__tac.stage({ ...pn.staged, seed: pn.seed });
      else window.__tac.begin({ seed: pn.seed, pilot: pn.pilot, fire: pn.fire ?? 7 });
      window.__draw(); window.__render();
    }, { pn, region, zoom });
    pages.push(p);
  }
  const clip = await pages[0].evaluate((r) => window.__clipFor(window.__film.cx - r[2] / 2, window.__film.cy - r[3] / 2, r[2], r[3]), region);
  const vw = videoWriter(OUT + file);
  const lab = 22, ft = 34, gap = 8, rows = Math.ceil(panels.length / cols), rowH = lab + clip.height + ft;
  const W = Math.max(cols * clip.width + (cols - 1) * gap, 720), H = rows * rowH + 40;
  let last;
  for (let f = 0; f < frames; f++) {
    const shots = [];
    for (const p of pages) {
      const st = await p.evaluate((per) => { for (let i = 0; i < per; i++) window.__tac.step(); window.__draw(); window.__render(); return window.__summary(); }, per);
      shots.push({ buf: await p.screenshot({ clip }), st });
    }
    const draws = [], texts = [];
    panels.forEach((pn, j) => {
      const x = (j % cols) * (clip.width + gap), y = Math.floor(j / cols) * rowH;
      draws.push({ i: j, sx: 0, sy: 0, sw: clip.width, sh: clip.height, dx: x, dy: y + lab });
      texts.push({ text: pn.title, x: x + 6, y: y + 16, size: 12, bold: true, color: VCOL[pn.vk] });
      const st = shots[j].st;
      const ln = [];
      if (st.mk) ln.push(`Marksman shots ${st.mkFire} · blind >1s now ${st.mkIdle}/${st.mk}`);
      if (st.bw) ln.push(`Bulwark shots ${st.bwFire} · blind >1s now ${st.bwIdle}/${st.bw}`);
      ln.push(`hits taken ${st.hits}`);
      texts.push({ text: ln.join('   '), x: x + 6, y: y + lab + clip.height + 14, size: 11, color: '#cfd6e4' });
      if (pn.sub) texts.push({ text: pn.sub, x: x + 6, y: y + lab + clip.height + 28, size: 11, color: VCOL[pn.vk] });
    });
    texts.push({ text: `${caption}  t ${t(f, per)}s`, x: 8, y: H - 22, size: 12, color: '#ffd9a0' });
    texts.push({ text: note, x: 8, y: H - 6, size: 11, color: '#cfd6e4' });
    await vw.write(await composite(shots.map((s) => s.buf), { W, H, draws, texts }));
    last = shots.map((s) => s.st);
  }
  await vw.end();
  // THE FILM MUST BE THE MEASURED RUNTIME: replay each panel headless on a
  // plain metrics page (no overlay, no render) and compare every tick
  for (let j = 0; j < pages.length; j++) {
    const got = await pages[j].evaluate(() => window.__tac.trace.slice());
    await pages[j].close();
    const pn = panels[j];
    const ref = await (async () => {
      const p = await tacPage(browser, VARIANTS[pn.vk], pn.q, pn.seed);
      const tr = await p.evaluate(({ pn, n }) => {
        if (pn.staged) window.__tac.stage({ ...pn.staged, seed: pn.seed }); else window.__tac.begin({ seed: pn.seed, pilot: pn.pilot, fire: pn.fire ?? 7 });
        for (let i = 0; i < n; i++) window.__tac.step();
        return window.__tac.trace.slice();
      }, { pn, n: got.length });
      await p.close();
      return tr;
    })();
    const d = got.findIndex((x, i) => x[0] !== ref[i]?.[0] || x[1] !== ref[i]?.[1]);
    if (d !== -1 || got.length !== ref.length) fail(`${file} panel ${j} (${pn.title}): the filmed run left the measured one at tick ${d} (${got.length} vs ${ref.length})`);
    console.log(`  verified ${file} panel ${j} (${pn.title}): ${got.length} ticks identical to the headless replay`);
  }
  console.log('wrote', OUT + file, JSON.stringify(last));
}

const NOTE = 'line GREEN = the AI can see and shoot this tick · RED = blocked (blocking body outlined) · cyan diamond = nearest reachable spot with a line (instrument only)';
const S = (name, vk, title, sub, center) => ({ vk, q: Q.stagedRoom, seed: 1001, staged: STAGED[name], title, sub, center });

async function marksman() {
  await film('marksman-passivity.webm', [
    S('M1_clear_hold', 'frozen', 'M1 CLEAR HOLD — positive control', 'line open: charges, locks, fires', [1180, 880]),
    S('M2_blocked_hold', 'frozen', 'M2 BLOCKED HOLD — frozen', 'in its band, line cut by the console'),
    S('M2_blocked_hold', 'mkB', 'M2 BLOCKED HOLD — ?marksmanStuck=early', 'the stuck correction has nothing to correct'),
    S('M7_three_marksmen', 'frozen', 'M7 THREE MARKSMEN — frozen', 'two blind, one with a line'),
  ], { region: [550, 30, 1010, 850], zoom: 0.42, frames: 450, cols: 2,
    caption: '1x — the REAL Detention Block, staged Marksmen, standing player (god mode), seed 1001. Nothing is frozen.',
    note: NOTE });
}
async function bulwark() {
  await film('bulwark-passivity.webm', [
    S('B1_clear_hold', 'frozen', 'B1 CLEAR HOLD — positive control', 'line open: warns and fires every ~1.5s', [1180, 880]),
    S('B2_blocked_hold', 'frozen', 'B2 BLOCKED HOLD — frozen', 'stops at 290px with the console in the way'),
    S('B2_blocked_hold', 'bwB', 'B2 BLOCKED HOLD — ?bulwarkStuck=early', 'the approved stuck fix: nothing to fix here'),
    S('B5_three_bulwarks', 'frozen', 'B5 THREE BULWARKS — frozen', 'all three stop at range behind cover'),
  ], { region: [600, 30, 800, 850], zoom: 0.46, frames: 450, cols: 2,
    caption: '1x — the REAL Detention Block, staged Bulwarks, standing player (god mode), seed 1001. Nothing is frozen.',
    note: NOTE });
}
async function mixed() {
  const E = (vk, title, sub) => ({ vk, q: Q.mixed, seed: 1001, pilot: { mode: 'handset' }, fire: 7, title, sub });
  await film('mixed-handset-repro.webm', [
    E('frozen', 'MIXED — FROZEN (no stuck flag)', 'roster=v1 gait=v2 move=v22'),
    E('mkB', 'MIXED — ?marksmanStuck=early (the handset URL)', 'roster=v1 gait=v2 move=v22 marksmanStuck=early'),
  ], { region: [0, 0, 1600, 1400], zoom: 0.4, frames: 1200, cols: 2,
    caption: 'RECONSTRUCTION, not the recording — ?encdbg=mixed&room=detention&sector=12&wave=2, real spawner, AI live, 1x, seed 1001, handset pilot: hide behind a checkpoint console, step out, hide behind the other, fire',
    note: NOTE });
}
const steps = { marksman, bulwark, mixed };
for (const s of (ARGS.length ? ARGS : Object.keys(steps))) { if (!steps[s]) fail(`unknown step ${s}`); console.log('──', s); await steps[s](); }
await browser.close();
