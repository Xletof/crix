// EVIDENCE — R0: the integrated configurations on film. Writes
// docs/evidence/integrated-combat-r0/r0-*.webm. Asserts nothing about
// behaviour; it FAILS if a film is not the measured runtime.
//
// The verified-film machinery of `shot-marksman-angle.mjs` / `shot-bulwark-
// angle.mjs`, unchanged in substance: each panel is the live game with its real
// URL flags (`CONFIGS` in diag-integrated-r0), stepped by the tactical diag's
// own `__tac.step` headless, 2 game ticks per 30fps frame (real 1x), the
// shutter render and every overlay draw on a throwaway generator, the game
// camera borrowed and put back; afterwards every panel is replayed headless on
// a plain metrics page and must match tick for tick (position hash + random
// draw count), or the run fails.
//
// THE OVERLAY, read from the instrument's rows and the modules' own state (never set):
//   line to player   Marksmen and free Bulwarks: GREEN = can see and shoot this
//                    tick; RED = cut (blocking body outlined); BLUE = open, not seen
//   cyan arc         every shield (free Bulwark and VANGUARD screen), frozen law
//   amber path       a T1 / T2 committed route and its destination ring
//   MAGENTA ring     a STUCK SIDESTEP being taken this tick (the frozen base
//                    recovery, or `marksmanStuck=early` / `bulwarkStuck=early`'s
//                    re-armed one) — the movement the B vs C question is about
//   labels           role (ELITE / NEMESIS / SCREEN / CAPTAIN), and for Marksmen
//                    and free Bulwarks what the module says it is doing
//
// usage: node tests/shot-integrated-r0.mjs [mixed nest vanguard progA progB] [--frames=N] [--seed=N]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { CHROME, bootPage } from './diag-stuck-audit.mjs';
import { installTac, R, BRANCH } from './diag-tactical-engagement.mjs';
import { CONFIGS, Q } from './diag-integrated-r0.mjs';

const ARGS = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const OUT = opt('out', new URL('../docs/evidence/integrated-combat-r0/', import.meta.url).pathname);
const FFMPEG = '/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const fail = (m) => { console.error(`FAIL: ${m}`); process.exit(1); };
const b64 = (buf) => `data:image/png;base64,${buf.toString('base64')}`;
const VCOL = { A: '#c8ccd6', B: '#9fe0a8', C: '#ffd28a', D_noBA: '#9fc8ff' };

async function plainPage(cfg, q, seed) {
  const p = await bootPage(browser, { flags: CONFIGS[cfg], q, seed });
  await installTac(p);
  await p.evaluate(() => { window.__headless = true; });
  return p;
}

function videoWriter(file, fps = 30) {
  const ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(fps), '-i', 'pipe:0',
    '-vf', 'format=yuv420p', '-c:v', 'vp8', '-b:v', '5M', '-crf', '8', '-qmin', '2', '-qmax', '30', '-auto-alt-ref', '0', file]);
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
    for (const t of texts) { x.font = `${t.bold ? 'bold ' : ''}${t.size || 14}px monospace`; x.fillStyle = t.color || '#e4e7ee'; x.textAlign = t.align || 'left'; if (t.maxW) x.fillText(t.text, t.x, t.y, t.maxW); else x.fillText(t.text, t.x, t.y); }
    return c.toDataURL('image/jpeg', 0.9);
  };
});
const composite = async (bufs, spec) => Buffer.from((await comp.evaluate(({ srcs, spec }) => window.__comp(srcs, spec), { srcs: bufs.map(b64), spec })).split(',')[1], 'base64');

// ── a filming page: the metrics page + the isolated overlay and shutter ──
async function filmPage(cfg, q, seed) {
  const p = await plainPage(cfg, q, seed);
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
    const ST = { line: 'LINE OPEN', confirm: 'LINE CUT · CONFIRMING', move: 'MOVING TO A FIRING SPOT', settle: 'SETTLING ON A LINE', overwatch: 'OVERWATCH',
      noSpot: 'NO SPOT · HOLDING', sidestep: 'STUCK SIDESTEP', retreat: 'RETREATING', charge: 'CHARGING', brace: 'BRACED', keep: 'KEEPING ITS SPOT', idle: 'HOLD' };
    const side = { mk: 0, mkTicks: 0 };
    window.__draw = isolated(() => {
      G.clear();
      let k = 0;
      const z = window.__film.zoom;
      for (const e of gs.enemies.getChildren()) {
        if (!(e.active && e.alive)) continue;
        const r = e.__tac, w = r?.rows?.[r.rows.length - 1];
        const isSn = e.enemyType === 'sniper' && !e._miniBoss, isFreeBw = e.enemyType === 'shielded' && !e._screen && !e._miniBoss;
        let label = `${e._elite ? 'ELITE ' : ''}${e.isChampion ? 'CAPTAIN' : (ROLE[e.enemyType] || String(e.enemyType).toUpperCase())}${e._miniBoss ? ' (NEMESIS)' : ''}${e._screen ? ' · SCREEN' : ''}`;
        if (e.enemyType === 'shielded') { G.lineStyle(2.4 / z, 0x5fd8ff, 0.9); G.beginPath(); G.arc(e.x, e.y, 46, e._shieldFacing - e._shieldHalfArc, e._shieldFacing + e._shieldHalfArc); G.strokePath(); }
        if ((isSn || isFreeBw) && w) {
          const valid = w[R.see] === 1 && w[R.los] === 1, unseen = !valid && w[R.los] === 1;
          G.lineStyle(2 / z, valid ? 0x50ff80 : unseen ? 0x8fa6ff : 0xff4040, valid ? 0.55 : 0.8);
          G.beginPath(); G.moveTo(e.x, e.y); G.lineTo(P.x, P.y); G.strokePath();
          if (w[R.blocker] >= 0) { const b = gs.losRects[w[R.blocker]]; G.lineStyle(2.2 / z, 0xff4040, 0.9); G.strokeRect(b.x, b.y, b.width, b.height); }
          const M = e._marksmanAngle || e._bulwarkAngle;
          if (M?.commit) {
            const K = M.commit;
            G.lineStyle(2.2 / z, 0xffb030, 0.95); G.beginPath(); G.moveTo(e.x, e.y);
            for (let i = K.wi; i < (K.path?.length || 0); i++) G.lineTo(K.path[i].x, K.path[i].y);
            G.lineTo(K.x, K.y); G.strokePath(); G.lineStyle(2.6 / z, 0xffb030, 1); G.strokeCircle(K.x, K.y, 9 / z);
          }
          const act = M ? (ST[M.state] || String(M.state).toUpperCase()) : `${BRANCH[w[R.branch]].replace('_', ' ')} · ${valid ? 'LINE OPEN' : unseen ? 'NOT SEEN' : 'LOS CUT'}`;
          label += `\n${act}${e._charging ? ' · CHARGING' : e._warnFlashed ? ' · WARN' : ''}`;
        }
        // a stuck sidestep taken this tick (the instrument's own command read)
        const sidestep = w && w[R.cmd] === 2;
        if (sidestep) { G.lineStyle(3 / z, 0xff40ff, 1); G.strokeCircle(e.x, e.y, 30); label += '\nSTUCK SIDESTEP'; if (isSn) side.mkTicks++; }
        const t = txt(k++, 15);
        t.setText(label).setColor(sidestep ? '#ff9cff' : e._screen ? '#b8c8ff' : (isSn || isFreeBw) ? '#ffffff' : '#c8ccd6')
          .setPosition(e.x, e.y - (e.displayHeight || 60) * 0.55 - 4).setScale(11 / 15 / z).setVisible(true);
      }
      for (let i = k; i < TX.length; i++) TX[i].setVisible(false);
      gs._sectorTint?.setAlpha(0);
    });
    window.__summary = () => {
      const o = { live: 0, mk: 0, mkShots: 0, mkSide: 0, bwShots: 0, hits: T.hits.length, hitsMk: T.hits.filter((h) => h[1] === 220).length };
      for (const e of gs.enemies.getChildren()) if (e.active && e.alive) o.live++;
      for (const r of T.list) {
        if (r.ref) continue;
        if (r.type === 'sniper') { o.mk++; o.mkShots += r.shotsN; o.mkSide += r.rows.filter((w) => w[R.cmd] === 2).length; }
        if (r.type === 'shielded' && !r.screen) o.bwShots += r.shotsN;
      }
      return o;
    };
  }, { R, BRANCH });
  return p;
}

const t = (f, per = 2) => (f * per / 60).toFixed(1);

// ── one film: N panels in lockstep, each its own page ───────────────────
async function film(file, panels, { zoom, frames, per = 2, cols = panels.length, caption, note }) {
  frames = +opt('frames', frames);
  const pages = [];
  let region = null;
  for (const pn of panels) {
    const p = await filmPage(pn.cfg, pn.q, pn.seed);
    const b = await p.evaluate(() => window.__gs.roomSpec.bounds);
    region = region || [0, 0, b.w, b.h];
    await p.evaluate(({ pn, region, zoom }) => {
      window.__film = { cx: region[0] + region[2] / 2, cy: region[1] + region[3] / 2, zoom };
      window.__tac.begin({ seed: pn.seed, pilot: pn.pilot, fire: pn.fire ?? 7 });
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
      const mw = clip.width - 12, st = shots[j].st;
      texts.push({ text: pn.title, x: x + 6, y: y + 16, size: 12, bold: true, color: VCOL[pn.cfg], maxW: mw });
      texts.push({ text: `live ${st.live} · hits on player ${st.hits} (Marksman ${st.hitsMk}) · Marksman shots ${st.mkShots} · Marksman sidestep ${(st.mkSide / 60).toFixed(1)}s · free Bulwark shots ${st.bwShots}`, x: x + 6, y: y + lab + clip.height + 14, size: 11, color: '#cfd6e4', maxW: mw });
      if (pn.sub) texts.push({ text: pn.sub, x: x + 6, y: y + lab + clip.height + 28, size: 11, color: VCOL[pn.cfg], maxW: mw });
    });
    texts.push({ text: `${caption}  t ${t(f, per)}s`, x: 8, y: H - 22, size: 12, color: '#ffd9a0', maxW: W - 16 });
    texts.push({ text: note, x: 8, y: H - 6, size: 11, color: '#cfd6e4', maxW: W - 16 });
    await vw.write(await composite(shots.map((s) => s.buf), { W, H, draws, texts }));
    last = shots.map((s) => s.st);
  }
  await vw.end();
  // THE FILM MUST BE THE MEASURED RUNTIME: replay each panel headless on a
  // plain metrics page (no overlay, no render) and compare every tick
  const traces = [];
  for (let j = 0; j < pages.length; j++) {
    const got = await pages[j].evaluate(() => window.__tac.trace.slice());
    await pages[j].close();
    const pn = panels[j];
    const p = await plainPage(pn.cfg, pn.q, pn.seed);
    const ref = await p.evaluate(({ pn, n }) => {
      window.__tac.begin({ seed: pn.seed, pilot: pn.pilot, fire: pn.fire ?? 7 });
      for (let i = 0; i < n; i++) window.__tac.step();
      return window.__tac.trace.slice();
    }, { pn, n: got.length });
    await p.close();
    const d = got.findIndex((x, i) => x[0] !== ref[i]?.[0] || x[1] !== ref[i]?.[1]);
    if (d !== -1) console.error(`  ${file} panel ${j}: film ${JSON.stringify(got.slice(Math.max(0, d - 2), d + 2))} replay ${JSON.stringify(ref.slice(Math.max(0, d - 2), d + 2))}`);
    if (d !== -1 || got.length !== ref.length) fail(`${file} panel ${j} (${pn.title}): the filmed run left the measured one at tick ${d} (${got.length} vs ${ref.length})`);
    const hash = got.reduce((h, x) => (h * 31 + x[0] + x[1]) % 1e9, 7);
    traces.push(got);
    console.log(`  verified ${file} panel ${j} (${pn.title}): ${got.length} ticks identical to the headless replay; traceHash ${hash}`);
  }
  // panels that should be the same fight: report where they part ways
  for (let j = 1; j < traces.length; j++) {
    const d = traces[j].findIndex((x, i) => x[0] !== traces[0][i]?.[0] || x[1] !== traces[0][i]?.[1]);
    console.log(`  ${file} panel ${j} vs panel 0: first divergence tick ${d} (-1 = identical)`);
  }
  console.log('wrote', OUT + file, JSON.stringify(last));
}

const NOTE = 'line GREEN = can see and shoot · RED = cut (body outlined) · BLUE = open, not seen · cyan = shield · amber = T1/T2 committed route · MAGENTA ring = stuck sidestep taken';
const SUB = { A: 'production default: no gameplay flags', B: 'roster v1 · move v22 · gait v2 · bulwarkStuck=early · marksmanAngle=1 · bulwarkAngle=1',
  C: 'B + marksmanStuck=early (NOT approved)', D_noBA: 'B without bulwarkAngle (T2 isolation)' };
const TITLE = { A: 'A — PRODUCTION DEFAULT', B: 'B — APPROVED INTEGRATION', C: 'C — B + MARKSMAN STUCK-B', D_noBA: 'D — B WITHOUT T2' };
const E = (cfg, q, pilot, seed, extra = '') => ({ cfg, q, seed, pilot: { mode: pilot }, fire: 7, title: `${TITLE[cfg]}${extra}`, sub: SUB[cfg] });
const SEED = +opt('seed', 1001);

const steps = {
  mixed: () => film('r0-mixed-abc.webm', ['A', 'B', 'C'].map((c) => E(c, Q.mixed, 'handset', SEED)), { zoom: 0.3, frames: 1200, cols: 3,
    caption: `MIXED (detention, sector 12, wave 2) — real spawner, AI live, 1x, seed ${SEED}, handset pilot (hide behind a checkpoint console, step out, hide behind the other, fire), god mode`, note: NOTE }),
  nest: () => film('r0-sniper-nest-bc.webm', [E('B', Q.nest, opt('pilot', 'hop2'), SEED), E('C', Q.nest, opt('pilot', 'hop2'), SEED), E('B', Q.nest, 'hide', SEED, ' · hide'), E('C', Q.nest, 'hide', SEED, ' · hide')],
    { zoom: 0.3, frames: 1200, cols: 2,
      caption: `SNIPER NEST (detention, sector 8, wave 2) — top: ${opt('pilot', 'hop2')} pilot (runs to the other checkpoint console every 4s); bottom: hide pilot — seed ${SEED}, 1x, god mode`, note: NOTE }),
  vanguard: () => film('r0-vanguard-invariance.webm', ['A', 'B', 'C', 'D_noBA'].map((c) => E(c, Q.vanguardCaptain, 'handset', SEED)), { zoom: 0.25, frames: +opt('vframes', 1200), cols: 2,
    caption: `VANGUARD + CAPTAIN (hangar, sector 8, wave 2) — the authored placement, real spawner, 1x, seed ${SEED}, handset pilot, god mode`, note: NOTE }),
  progA: () => film('r0-progression-hangar-s10.webm', ['A', 'B'].map((c) => E(c, Q.p_hangar_s10w1, 'handset', SEED)), { zoom: 0.3, frames: 900, cols: 2,
    caption: `ORDINARY PROGRESSION — hangar, sector 10, wave 1 (the real resolver picks the encounter) — seed ${SEED}, 1x, handset pilot, god mode`, note: NOTE }),
  progB: () => film('r0-progression-junction-s14.webm', ['A', 'B'].map((c) => E(c, Q.p_corridor_s14w3, 'handset', SEED)), { zoom: 0.3, frames: 900, cols: 2,
    caption: `ORDINARY PROGRESSION — reactor junction, sector 14, wave 3 (the real resolver picks the encounter) — seed ${SEED}, 1x, handset pilot, god mode`, note: NOTE }),
};
for (const s of (ARGS.length ? ARGS : Object.keys(steps))) { if (!steps[s]) fail(`unknown step ${s}`); console.log('──', s); await steps[s](); }
await browser.close();
