// EVIDENCE — PHASE 3C-T1: the responsive Marksman (`?marksmanAngle=1`) on film.
// Writes docs/evidence/marksman-angle-t1/t1-*.webm. Asserts nothing about
// behaviour; it FAILS if a film is not the measured runtime.
//
// The same verified-film machinery as `shot-tactical-engagement.mjs` (Phase
// 3C-B): each panel is the live game with its real URL flags, stepped by the
// tactical diag's own `__tac.step` headless, 2 game ticks per 30fps frame
// (real 1x), the shutter render and every overlay draw on a throwaway
// generator, the game camera borrowed and put back, and afterwards every panel
// is replayed headless on a plain page and must match tick for tick.
//
// THE OVERLAY, read from the instrument's row and the module's own state for
// the tick (never set):
//   line to player   GREEN = the AI can see and shoot this tick; RED = cut,
//                    the blocking body outlined; BLUE = geometrically open
//                    but not SEEN (the frozen patrol vision cone, or
//                    concealment) — not a cut line, and not this module's
//   amber path       the candidate's committed route and destination ring
//   label            role, then what it is doing: HOLD · LINE OPEN, CHARGE /
//                    LOCK, CONFIRMING, REPOSITIONING, OVERWATCH, NO SPOT —
//                    HOLDING, RETREAT; on a frozen panel, how long it has stood
//                    blind
//   timing           "line lost Xs · moving after Yms": the blind episode's own
//                    clock, from the tick the line was cut to the first tick
//                    the body moved (or "not moving" while it has not)
//
// usage: node tests/shot-marksman-angle.mjs [blind hop charge nest mixed] [--frames=N]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { CHROME } from './diag-stuck-audit.mjs';
import { tacPage, T1_STAGED, VARIANTS, Q, R, BRANCH, ASTATE } from './diag-tactical-engagement.mjs';

const ARGS = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const OUT = opt('out', new URL('../docs/evidence/marksman-angle-t1/', import.meta.url).pathname);
const FFMPEG = '/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const fail = (m) => { console.error(`FAIL: ${m}`); process.exit(1); };
const b64 = (buf) => `data:image/png;base64,${buf.toString('base64')}`;

const VCOL = { frozen: '#ff9a8a', mkB: '#ff9a8a', ang: '#9fe0a8', angB: '#9fe0a8' };

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
    const passive = new Map();   // actor rec -> ticks standing without a line (frozen panels)
    const lastT = new Map();
    const epi = new Map();       // actor rec -> { start, moved } of the current blind episode
    window.__draw = isolated(() => {
      G.clear();
      let k = 0;
      const z = window.__film.zoom;
      for (const e of gs.enemies.getChildren()) {
        if (!(e.active && e.alive) || (e.__tac && !e.__tac.ref)) continue;
        const t = txt(k++); t.setText(`${e._elite ? 'ELITE ' : ''}${ROLE[e.enemyType] || e.enemyType.toUpperCase()}${e._miniBoss ? ' (NEMESIS)' : ''}`)
          .setColor('#c8ccd6').setPosition(e.x, e.y - (e.displayHeight || 60) * 0.5).setScale(10 / 15 / z).setVisible(true);
      }
      for (const r of T.list) {
        const e = r.e;
        if (r.ref || r.type !== 'sniper' || !(e.active && e.alive)) continue;
        const w = r.rows[r.rows.length - 1];
        if (!w) continue;
        const valid = w[R.see] === 1 && w[R.los] === 1;
        // the line is open but the AI does not see the player (its patrol
        // vision cone, or concealment): the frozen awareness, not a cut line
        const unseen = !valid && w[R.los] === 1;
        const standing = Math.hypot(w[R.dx], w[R.dy]) < 0.5;
        const dt = w[R.tick] - (lastT.get(r) ?? w[R.tick]);
        lastT.set(r, w[R.tick]);
        const pv = (!valid && standing && !w[R.charging]) ? (passive.get(r) || 0) + dt : 0;
        passive.set(r, pv);
        // the blind episode's own clock (geometric line, as the module sees it)
        let ep = epi.get(r);
        if (w[R.los] === 0 && !w[R.charging]) { if (!ep) { ep = { start: w[R.tick], moved: null }; epi.set(r, ep); } if (ep.moved == null && !standing) ep.moved = w[R.tick]; }
        else if (ep) { epi.delete(r); ep = null; }
        G.lineStyle(2.2 / z, valid ? 0x50ff80 : unseen ? 0x8fa6ff : 0xff4040, valid ? 0.6 : 0.85);
        G.beginPath(); G.moveTo(e.x, e.y); G.lineTo(P.x, P.y); G.strokePath();
        if (w[R.blocker] >= 0) { const b = gs.losRects[w[R.blocker]]; G.lineStyle(2.5 / z, 0xff4040, 1); G.strokeRect(b.x, b.y, b.width, b.height); }
        const M = e._marksmanAngle;
        if (M?.commit) {
          const K = M.commit;
          G.lineStyle(2.2 / z, 0xffb030, 0.95);
          G.beginPath(); G.moveTo(e.x, e.y);
          for (let i = K.wi; i < K.path.length; i++) G.lineTo(K.path[i].x, K.path[i].y);
          G.strokePath();
          G.lineStyle(2.6 / z, 0xffb030, 1); G.strokeCircle(K.x, K.y, 9 / z);
        }
        const role = (r.elite ? 'ELITE ' : '') + 'MARKSMAN';
        const chg = e._charging ? (e._chargeMs <= e.cfg.lockMs ? 'LOCK' : 'CHARGE') : '';
        let act;
        if (M) {
          const st = M.state;
          act = chg || ({ line: valid ? 'HOLD · LINE OPEN' : 'HOLD · NOT SEEN', confirm: 'LINE CUT · CONFIRMING', move: 'REPOSITIONING', settle: 'SETTLING ON A LINE',
            overwatch: 'OVERWATCH (target keeps moving)', noSpot: 'NO SPOT · HOLDING', retreat: 'RETREAT', sidestep: 'STUCK SIDESTEP', idle: 'HOLD', charge: 'CHARGE' }[st] || st.toUpperCase());
          if (st === 'move' && M.branch === 'approach') act = 'APPROACHING A FIRING SPOT';
        } else {
          act = chg || `${BRANCH[w[R.branch]].replace('_', ' ')} · ${valid ? 'LINE OPEN' : unseen ? 'NOT SEEN' : 'LOS BLOCKED'}${pv > 30 ? ` · idle ${(pv / 60).toFixed(1)}s` : ''}`;
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
      const o = { mk: 0, mkFire: 0, mkIdle: 0, moving: 0, hits: T.hits.filter((h) => h[1] === 220).length };
      for (const r of T.list) {
        if (r.ref || r.type !== 'sniper') continue;
        o.mk++; o.mkFire += r.shotsN;
        const pv = passive.get(r) || 0;
        if (pv > 60 && r.e.active && r.e.alive) o.mkIdle++;
        if (r.e._marksmanAngle?.commit && r.e.active && r.e.alive) o.moving++;
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
      texts.push({ text: `Marksman shots ${st.mkFire} · hits on player ${st.hits} · blind >1s now ${st.mkIdle}/${st.mk} · moving now ${st.moving}`, x: x + 6, y: y + lab + clip.height + 14, size: 11, color: '#cfd6e4', maxW: mw });
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

const NOTE = 'line GREEN = can see and shoot · RED = cut (body outlined) · BLUE = open but not seen (patrol vision / concealment) · amber = committed route · labels read from the game';
const S = (name, vk, title, sub, center) => ({ vk, q: Q.stagedRoom, seed: 1001, staged: T1_STAGED[name], title, sub, center });
const BASEV = 'mkB', CANDV = 'angB';   // the human's URL, and the same URL + ?marksmanAngle=1

async function blind() {
  await film('t1-blind-console-ab.webm', [
    S('T2_blind_console', BASEV, 'BASELINE — the URL that was rejected', 'roster=v1 gait=v2 move=v22 marksmanStuck=early'),
    S('T2_blind_console', CANDV, 'CANDIDATE — same URL + marksmanAngle=1', 'immediate evaluation, short confirmation, one committed walk'),
    S('T2e_blind_console_elite', BASEV, 'BASELINE — Elite Marksman', ''),
    S('T2e_blind_console_elite', CANDV, 'CANDIDATE — Elite Marksman', ''),
  ], { region: [700, 40, 860, 840], zoom: 0.46, frames: 360, cols: 2,
    caption: '1x — real Detention Block, Marksman 520px north of a player who stays behind the heavy console (god mode), seed 1001. Nothing is frozen.',
    note: NOTE });
}
async function hop() {
  await film('t1-cover-hop.webm', [
    S('T5_cover_hop', BASEV, 'BASELINE — player hops between the checkpoint consoles', 'every 4s, then stays opposite the Marksman'),
    S('T5_cover_hop', CANDV, 'CANDIDATE', 'follows each hop with one walk, no pauses between decisions'),
    S('T4_circle_console', BASEV, 'BASELINE — player circles a console', ''),
    S('T4_circle_console', CANDV, 'CANDIDATE', ''),
  ], { region: [240, 40, 1160, 860], zoom: 0.4, frames: 600, cols: 2,
    caption: '1x — real Detention Block, player moving between cover (real keys, real physics, god mode), seed 1001.',
    note: NOTE });
}
async function charge() {
  await film('t1-charge-integrity.webm', [
    S('T1_clear_los', CANDV, 'CANDIDATE — clear line: charge, lock, shot (identical to baseline)', 'nothing moves: the frozen weapon, untouched', [1200, 1000]),
    S('T11_los_flicker', BASEV, 'BASELINE — line flickering behind the console', 'charges cancelled by the cut line, re-armed in 500ms'),
    S('T11_los_flicker', CANDV, 'CANDIDATE — the same flicker', 'a cancelled charge, then a walk to a line that holds'),
    S('T6_rush', CANDV, 'CANDIDATE — the player rushes it', 'retreat always wins; charge logic unchanged', [620, 440]),
  ], { region: [700, 40, 800, 880], zoom: 0.44, frames: 420, cols: 2,
    caption: '1x — the sniper\'s weapon is the frozen one: 800ms windup, 260ms lock, laser, locked shot, cancel on a cut line. Seed 1001.',
    note: NOTE });
}
async function enc(file, q, title) {
  const E = (vk, t, sub) => ({ vk, q, seed: 1001, pilot: { mode: 'handset' }, fire: 7, title: t, sub });
  await film(file, [
    E(BASEV, 'BASELINE — the rejected URL', 'roster=v1 gait=v2 move=v22 marksmanStuck=early'),
    E(CANDV, 'CANDIDATE — the same URL + marksmanAngle=1', 'roster=v1 gait=v2 move=v22 marksmanStuck=early marksmanAngle=1'),
  ], { region: [0, 0, 1600, 1400], zoom: 0.4, frames: 1200, cols: 2,
    caption: `${title} — real spawner, AI live, 1x, seed 1001, handset pilot: hide behind a checkpoint console, step out, hide behind the other, fire`,
    note: NOTE });
}
const nest = () => enc('t1-sniper-nest.webm', Q.nest, 'SNIPER NEST (detention, sector 8, wave 2)');
const mixed = () => enc('t1-mixed.webm', Q.mixed, 'MIXED (detention, sector 12, wave 2) — the encounter the human rejected');
const steps = { blind, hop, charge, nest, mixed };
for (const s of (ARGS.length ? ARGS : Object.keys(steps))) { if (!steps[s]) fail(`unknown step ${s}`); console.log('──', s); await steps[s](); }
await browser.close();
