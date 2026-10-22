// EVIDENCE — PHASE T2: the free Bulwark's tactical engagement
// (`?bulwarkAngle=1`) on film. Writes docs/evidence/bulwark-angle-t2/t2-*.webm.
// Asserts nothing about behaviour; it FAILS if a film is not the measured runtime.
//
// The verified-film machinery of `shot-marksman-angle.mjs` (Phase 3C-T1),
// unchanged: each panel is the live game with its real URL flags, stepped by
// the tactical diag's own `__tac.step` headless, 2 game ticks per 30fps frame
// (real 1x), the shutter render and every overlay draw on a throwaway
// generator, the game camera borrowed and put back, and afterwards every panel
// is replayed headless on a plain page and must match tick for tick.
//
// THE OVERLAY, read from the instrument's row and the module's own state for
// the tick (never set):
//   line to player   GREEN = the AI can see and shoot this tick; RED = cut,
//                    the blocking body outlined; BLUE = geometrically open
//                    but not SEEN (the frozen patrol vision, or concealment)
//   cyan arc         the SHIELD: its live facing and half-arc (the frozen
//                    turn law — the candidate never writes it)
//   amber path       the candidate's committed route and destination ring
//   label            role, then what it is doing: HOLD · LINE OPEN, LINE CUT ·
//                    CONFIRMING, PRESSING ROUND COVER, KEEPING ITS SPOT, BRACED,
//                    NO SPOT · HOLDING; on a frozen panel, how long it has stood
//                    blind. A VANGUARD screen is labelled as one and is never
//                    the candidate's.
//   timing           "line lost Xs · moving after Yms": the blind episode's own
//                    clock, from the tick the line was cut to the first tick
//                    the body moved (or "not moving" while it has not)
//
// usage: node tests/shot-bulwark-angle.mjs [blind cover flank mixed vanguard] [--frames=N]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { CHROME } from './diag-stuck-audit.mjs';
import { tacPage, T2_STAGED, VARIANTS, Q, R, BRANCH, ASTATE } from './diag-tactical-engagement.mjs';

const ARGS = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const OUT = opt('out', new URL('../docs/evidence/bulwark-angle-t2/', import.meta.url).pathname);
const FFMPEG = '/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const fail = (m) => { console.error(`FAIL: ${m}`); process.exit(1); };
const b64 = (buf) => `data:image/png;base64,${buf.toString('base64')}`;

const VCOL = { frozen: '#ff9a8a', bwB: '#ff9a8a', t1base: '#ff9a8a', bwA: '#9fe0a8', bwAB: '#9fe0a8', t1bw: '#9fe0a8' };

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
    for (const t of texts) { x.font = `${t.bold ? 'bold ' : ''}${t.size || 14}px monospace`; x.fillStyle = t.color || '#e4e7ee'; x.textAlign = t.align || 'left'; if (t.maxW) x.fillText(t.text, t.x, t.y, t.maxW); else x.fillText(t.text, t.x, t.y); }
    return c.toDataURL('image/jpeg', 0.92);
  };
});
const composite = async (bufs, spec) => Buffer.from((await comp.evaluate(({ srcs, spec }) => window.__comp(srcs, spec), { srcs: bufs.map(b64), spec })).split(',')[1], 'base64');

// ── a filming page: the metrics page + the isolated overlay and shutter ──
async function filmPage(vk, q, seed) {
  const p = await tacPage(browser, VARIANTS[vk], q, seed);
  await p.evaluate(({ R, BRANCH, ASTATE }) => {
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
    const passive = new Map();   // actor rec -> ticks standing without a line (frozen panels)
    const lastT = new Map();
    const epi = new Map();       // actor rec -> { start, moved } of the current blind episode
    window.__draw = isolated(() => {
      G.clear();
      let k = 0;
      const z = window.__film.zoom;
      for (const e of gs.enemies.getChildren()) {
        if (!(e.active && e.alive)) continue;
        if (e.__tac && !e.__tac.ref && e.enemyType === 'shielded' && !e._screen) continue;   // drawn below
        let label = `${e._elite ? 'ELITE ' : ''}${ROLE[e.enemyType] || (e.isChampion ? 'CAPTAIN' : e.enemyType.toUpperCase())}${e._miniBoss ? ' (NEMESIS)' : ''}`;
        if (e._screen) label += ' · VANGUARD SCREEN';
        if (e._marksmanAngle) label += ' (T1)';
        const t = txt(k++); t.setText(label).setColor(e._screen ? '#b8c8ff' : '#c8ccd6').setPosition(e.x, e.y - (e.displayHeight || 60) * 0.5).setScale(10 / 15 / z).setVisible(true);
        if (e._screen) { G.lineStyle(2.4 / z, 0x5fd8ff, 0.9); G.beginPath(); G.arc(e.x, e.y, 46, e._shieldFacing - e._shieldHalfArc, e._shieldFacing + e._shieldHalfArc); G.strokePath(); }
      }
      for (const r of T.list) {
        const e = r.e;
        if (r.ref || r.type !== 'shielded' || r.screen || !(e.active && e.alive)) continue;
        const w = r.rows[r.rows.length - 1];
        if (!w) continue;
        const valid = w[R.see] === 1 && w[R.los] === 1;
        const unseen = !valid && w[R.los] === 1;
        const standing = Math.hypot(w[R.dx], w[R.dy]) < 0.5;
        const dt = w[R.tick] - (lastT.get(r) ?? w[R.tick]);
        lastT.set(r, w[R.tick]);
        const pv = (!valid && standing) ? (passive.get(r) || 0) + dt : 0;
        passive.set(r, pv);
        let ep = epi.get(r);
        if (w[R.los] === 0) { if (!ep) { ep = { start: w[R.tick], moved: null }; epi.set(r, ep); } if (ep.moved == null && !standing) ep.moved = w[R.tick]; }
        else if (ep) { epi.delete(r); ep = null; }
        G.lineStyle(2.2 / z, valid ? 0x50ff80 : unseen ? 0x8fa6ff : 0xff4040, valid ? 0.6 : 0.85);
        G.beginPath(); G.moveTo(e.x, e.y); G.lineTo(P.x, P.y); G.strokePath();
        if (w[R.blocker] >= 0) { const b = gs.losRects[w[R.blocker]]; G.lineStyle(2.5 / z, 0xff4040, 1); G.strokeRect(b.x, b.y, b.width, b.height); }
        // the shield, as the frozen class holds it
        G.lineStyle(3 / z, 0x5fd8ff, 0.95); G.beginPath(); G.arc(e.x, e.y, 46, e._shieldFacing - e._shieldHalfArc, e._shieldFacing + e._shieldHalfArc); G.strokePath();
        const M = e._bulwarkAngle;
        if (M?.commit) {
          const K = M.commit;
          G.lineStyle(2.2 / z, 0xffb030, 0.95);
          G.beginPath(); G.moveTo(e.x, e.y);
          for (let i = K.wi; i < K.path.length; i++) G.lineTo(K.path[i].x, K.path[i].y);
          G.strokePath();
          G.lineStyle(2.6 / z, 0xffb030, 1); G.strokeCircle(K.x, K.y, 9 / z);
        }
        const role = (r.elite ? 'ELITE ' : '') + 'BULWARK';
        const warn = e._warnFlashed ? ' · WARN' : '';
        let act;
        if (M) {
          const st = M.state;
          act = ({ line: valid ? 'HOLD · LINE OPEN' : 'HOLD · NOT SEEN', confirm: 'LINE CUT · CONFIRMING', move: 'PRESSING ROUND COVER', settle: 'SETTLING ON A LINE',
            brace: 'BRACED (target keeps moving)', keep: 'KEEPING ITS SPOT (target moving)', noSpot: 'NO SPOT · HOLDING', sidestep: 'STUCK SIDESTEP', idle: 'HOLD' }[st] || st.toUpperCase());
          if (st === 'line' && M.branch === 'approach') act = valid ? 'ADVANCING · LINE OPEN' : 'ADVANCING';
          if (st === 'move' && M.branch === 'approach') act = 'ADVANCING TO A FIRING SPOT';
          act += warn;
        } else {
          act = `${BRANCH[w[R.branch]].replace('_', ' ')} · ${valid ? 'LINE OPEN' : unseen ? 'NOT SEEN' : 'LOS BLOCKED'}${warn}${pv > 30 ? ` · idle ${(pv / 60).toFixed(1)}s` : ''}`;
        }
        let tim = '';
        if (ep) tim = `line lost ${((w[R.tick] - ep.start) / 60).toFixed(2)}s · ${ep.moved != null ? `moving after ${Math.round((ep.moved - ep.start) * 1000 / 60)}ms` : 'not moving'}`;
        const t = txt(k++, 15);
        t.setText(`${role}\n${act}${tim ? `\n${tim}` : ''}`)
          .setColor(valid ? '#d8ffe0' : (!M && pv > 60) ? '#ff8070' : M?.commit ? '#ffd28a' : '#ffffff')
          .setPosition(e.x, e.y - (e.displayHeight || 60) * 0.55 - 4).setScale(12 / 15 / z).setVisible(true);
      }
      for (let i = k; i < TX.length; i++) TX[i].setVisible(false);
      gs._sectorTint?.setAlpha(0);
    });
    window.__summary = () => {
      const o = { bw: 0, bwFire: 0, bwIdle: 0, moving: 0, screens: 0, installed: 0, hits: T.hits.filter((h) => h[1] === 120).length };
      for (const r of T.list) {
        if (r.ref || r.type !== 'shielded') continue;
        if (r.screen) { o.screens++; if (r.e._bulwarkAngle) o.installed++; continue; }
        o.bw++; o.bwFire += r.shotsN;
        const pv = passive.get(r) || 0;
        if (pv > 60 && r.e.active && r.e.alive) o.bwIdle++;
        if (r.e._bulwarkAngle?.commit && r.e.active && r.e.alive) o.moving++;
      }
      return o;
    };
  }, { R, BRANCH, ASTATE });
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
      // every line is squeezed to its own panel (fillText maxWidth), so a long
      // footer can never run into the panel beside it
      const mw = clip.width - 12;
      texts.push({ text: pn.title, x: x + 6, y: y + 16, size: 12, bold: true, color: VCOL[pn.vk], maxW: mw });
      const st = shots[j].st;
      texts.push({ text: st.screens && !st.bw ? `VANGUARD screens ${st.screens} · candidate installed on ${st.installed} · Bulwark hits on player ${st.hits}` : `free Bulwark shots ${st.bwFire} · hits on player ${st.hits} · blind >1s now ${st.bwIdle}/${st.bw} · pressing now ${st.moving}`, x: x + 6, y: y + lab + clip.height + 14, size: 11, color: '#cfd6e4', maxW: mw });
      if (pn.sub) texts.push({ text: pn.sub, x: x + 6, y: y + lab + clip.height + 28, size: 11, color: VCOL[pn.vk], maxW: mw });
    });
    texts.push({ text: `${caption}  t ${t(f, per)}s`, x: 8, y: H - 22, size: 12, color: '#ffd9a0', maxW: W - 16 });
    texts.push({ text: note, x: 8, y: H - 6, size: 11, color: '#cfd6e4', maxW: W - 16 });
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
    // a divergence prints the trace on both sides ([position hash, random draws]):
    // a draw count that moves first means the seeded stream was reached
    if (d !== -1) console.error(`  ${file} panel ${j}: film ${JSON.stringify(got.slice(Math.max(0, d - 2), d + 2))} replay ${JSON.stringify(ref.slice(Math.max(0, d - 2), d + 2))}`);
    if (d !== -1 || got.length !== ref.length) fail(`${file} panel ${j} (${pn.title}): the filmed run left the measured one at tick ${d} (${got.length} vs ${ref.length})`);
    console.log(`  verified ${file} panel ${j} (${pn.title}): ${got.length} ticks identical to the headless replay`);
  }
  console.log('wrote', OUT + file, JSON.stringify(last));
}

const NOTE = 'line GREEN = can see and shoot · RED = cut (body outlined) · BLUE = open but not seen · cyan arc = the frozen shield · amber = committed route · labels read from the game';
const S = (name, vk, title, sub, center) => ({ vk, q: Q.stagedRoom, seed: 1001, staged: T2_STAGED[name], title, sub, center });
const BASEV = 'bwB', CANDV = 'bwAB';   // the human's URL with the approved stuck correction, and the same + ?bulwarkAngle=1

async function blind() {
  await film('t2-blind-console-ab.webm', [
    S('B2_blind_console', BASEV, 'BASELINE — free Bulwark, line cut by the console', 'roster=v1 gait=v2 move=v22 bulwarkStuck=early'),
    S('B2_blind_console', CANDV, 'CANDIDATE — same URL + bulwarkAngle=1', 'immediate evaluation, short confirmation, presses round the console'),
    S('B2e_blind_console_elite', BASEV, 'BASELINE — Elite Bulwark', ''),
    S('B2e_blind_console_elite', CANDV, 'CANDIDATE — Elite Bulwark', ''),
  ], { region: [720, 380, 560, 520], zoom: 0.62, frames: 360, cols: 2,
    caption: '1x — real Detention Block, free Bulwark 289px north (inside its hold) of a player behind the heavy console (god mode), seed 1001.',
    note: NOTE });
}
async function cover() {
  await film('t2-cover-navigation.webm', [
    S('B4_narrow_passage', BASEV, 'BASELINE — round the south-west post and bunks', 'the approved stuck correction alone already walks it round here'),
    S('B4_narrow_passage', CANDV, 'CANDIDATE', 'a routed walk to a spot with a line'),
    S('B5_long_wall', BASEV, 'BASELINE — behind the long bunk', ''),
    S('B5_long_wall', CANDV, 'CANDIDATE', ''),
  ], { region: [40, 280, 900, 1080], zoom: 0.4, frames: 420, cols: 2,
    caption: '1x — real Detention Block, the player standing behind furniture (god mode), seed 1001. The Bulwark walks at its own frozen speed, shield up.',
    note: NOTE });
}
async function flank() {
  await film('t2-shield-flanking.webm', [
    S('B7_flank_loop', BASEV, 'BASELINE — the player runs round it (no cover)', 'the frozen shield: 2.6 rad/s, flankable', [1000, 420]),
    S('B7_flank_loop', CANDV, 'CANDIDATE — identical: it has a line, it holds', 'the candidate never writes the shield', [1000, 420]),
    S('B3_circle_console', BASEV, 'BASELINE — the player circles a console', '', [1000, 600]),
    S('B3_circle_console', CANDV, 'CANDIDATE', 'keeps a working spot for a moving target; no chase round every corner', [1000, 600]),
  ], { region: [740, 300, 520, 640], zoom: 0.56, frames: 450, cols: 2,
    caption: '1x — real Detention Block, seed 1001. The shield turns by the frozen law in every panel; a flank is still a flank.',
    note: NOTE });
}
async function mixed() {
  const E = (vk, t, sub) => ({ vk, q: Q.mixed, seed: 1001, pilot: { mode: 'handset' }, fire: 7, title: t, sub });
  await film('t2-mixed.webm', [
    E('t1base', 'BASELINE — approved T1 Marksman, frozen free Bulwark', 'roster=v1 gait=v2 move=v22 marksmanStuck=early marksmanAngle=1 bulwarkStuck=early'),
    E('t1bw', 'CANDIDATE — the same URL + bulwarkAngle=1', 'the ONLY difference between the halves is bulwarkAngle'),
  ], { region: [0, 0, 1600, 1400], zoom: 0.4, frames: 1200, cols: 2,
    caption: 'MIXED (detention, sector 12, wave 2) — real spawner, AI live, 1x, seed 1001, handset pilot: hide behind a checkpoint console, step out, hide behind the other, fire',
    note: NOTE });
}
async function vanguard() {
  const E = (vk, q, t, sub) => ({ vk, q, seed: 1001, pilot: { mode: 'handset' }, fire: 7, title: t, sub });
  await film('t2-vanguard-invariance.webm', [
    E(BASEV, Q.vanguard, 'VANGUARD — BASELINE', 'bulwarkStuck=early'),
    E(CANDV, Q.vanguard, 'VANGUARD — CANDIDATE (+ bulwarkAngle=1)', 'every shield is a screen: never installed'),
    E(BASEV, Q.vanguardCaptain, 'VANGUARD + CAPTAIN — BASELINE', ''),
    E(CANDV, Q.vanguardCaptain, 'VANGUARD + CAPTAIN — CANDIDATE', 'the same fight, tick for tick'),
  ], { region: [0, 0, 1600, 1400], zoom: 0.3, frames: 600, cols: 2,
    caption: 'VANGUARD (hangar, sector 8, wave 2), with and without the Shock Captain — real spawner, 1x, seed 1001, handset pilot. The candidate is excluded by construction.',
    note: NOTE });
}
const steps = { blind, cover, flank, mixed, vanguard };
for (const s of (ARGS.length ? ARGS : Object.keys(steps))) { if (!steps[s]) fail(`unknown step ${s}`); console.log('──', s); await steps[s](); }
await browser.close();
