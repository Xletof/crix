// SMOKE: P2-A3 — THE OVERRIDE REFINEMENT (`?visualPilot=v2c&polish=p1&fxPilot=p2a3`,
// and its STANDARD-discharge A/B `&muzzle=sharp`) — PRESENTATION OVER P2-A2,
// PROVEN AGAINST P2-A2 AND P1. Standalone; needs `npm run dev` on :5173 and,
// for section 11, the PREVIOUS build — `356b5df`, the P2-A2 build — on
// another port (`--old=URL`).
//
// A2 = `visualPilot=v2c&polish=p1&fxPilot=p2a2`  (P2-A2, the parent candidate)
// P1 = `visualPilot=v2c&polish=p1`               (approved, frozen)
// B  = `visualPilot=v2c&polish=p1&fxPilot=p2a3` (HUMAN-APPROVED 2026-11-09; the sharp STANDARD discharge by default)
// BS = B + `&muzzle=sharp` (the same as B)
// BC = B + `&muzzle=current` (the comparison flag: P2-A2's discharge)
// Nothing here says which version reads better (the handset's job). It proves:
//   0  THE FLAGS: `fxPilot=p2a3` honoured only with P1 live and carrying all
//      of P2-A2, sharp by default; `muzzle=current` only with P2-A3; every other
//      combination is that mode exactly
//   1  TEXTURES: B paints every P2-A2 texture byte-identically plus exactly the
//      eight `p2a3-*`; `muzzle=sharp` and ignored flags add nothing
//   2  INSTALL: B = P2-A2's listeners and wrappers plus one more HUD instance
//      wrapper; three world objects, hidden at rest
//   3  THE ROUND COUNT (refinement 1): during OVERRIDE the HUD's count and bar
//      equal `secondaryAmmo` on EVERY tick (P2-A2, the control, does not);
//      redrawn only when the value changes; the same events, shots, ticks,
//      ammunition and draws as P2-A2
//   4  THE READOUT (refinement 2): the count is the panel's largest element,
//      the three-round symbol, the bar cut every three rounds, the mode's name;
//      the cluster panel is the shipped one pixel for pixel; STANDARD shown on
//      running dry (and not on a swap to the cluster pod)
//   5  THE ACTIVE STATE (refinement 3): the rifle object is P2-A2's on every
//      tick; the cell only ever lights pixels the rifle has, rides it exactly
//      at 8 aims, shows only while OVERRIDE is engaged (and its run-dry beat);
//      the engage and run-dry sequences; one flick per round; the low-ammo
//      pulse; hidden mid-combo, dead, and fading in a bush
//   6  THE MUZZLE A/B (refinement 4): BC's (`muzzle=current`) STANDARD
//      discharge is P2-A2's, frame for frame; B (sharp) keeps its
//      texture, size, position and depth rule with a shorter persistence — and
//      the measured ink and lit frames per shot of both, in 4 states, at 60 Hz
//      (and a 30 Hz step, as a slow phone would)
//   7  SAME FIGHT: seeded replays with a REAL OVERRIDE pickup and a cluster pod:
//      B and BS vs P2-A2, B vs P1 (production + legacy, CROSSFIRE, BOMBER RUN,
//      rendered, LOW quality)
//   8  READER ONLY: no Math.random, no event, no gameplay write in the P2-A3
//      frame (its HUD restyle included)
//   9  BUDGET + LOW QUALITY
//  10  FROZEN FILES: no change against `356b5df` outside debug.js, p2aFx.js,
//      p2aPaint.js and the new p2a3Override.js (P2-A2's p2a2Loadout.js untouched)
//  11  AGAINST THE PREVIOUS BUILD (`--old`): R1, V2C, P1, P2-A and P2-A2
//      textures and fights are that build's; P2-A2's RENDERED frames (world and
//      HUD) are pixel-identical to that build's over a staged OVERRIDE +
//      STANDARD sequence, with and without an ignored `muzzle=sharp`
//  12  restart and reload keep the mode
// `--selftest` injects, in B only, a Math.random draw in the P2-A3 frame, an
// event emitted with each count redraw, and a 1px shift of the power cell:
// sections 3, 5, 7 and 8 must FAIL.
//
// usage: node tests/smoke-fx-p2a3.mjs [--old=URL] [--selftest] [--ticks=N] [--only=0,3]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { execSync } from 'node:child_process';
import { CHROME, bootPage, FIGHT_SEG } from './diag-stuck-audit.mjs';
import { enemyJsGuard } from './enemy-frozen.mjs';

const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const SELF = process.argv.includes('--selftest');
const OLD = opt('old', null);
const NOW = 'http://localhost:5173/';
const TICKS = +opt('ticks', '1500');
const BASE_REV = '356b5df';
const P1 = 'visualPilot=v2c&polish=p1', A = `${P1}&fxPilot=p2a`, A2 = `${P1}&fxPilot=p2a2`, B = `${P1}&fxPilot=p2a3`, BS = `${B}&muzzle=sharp`, BC = `${B}&muzzle=current`;
const Q_SWARM = 'encdbg=swarmTide&room=hangar&sector=3';
const Q_CROSS = 'encdbg=crossfire&room=hangar&sector=6';
const Q_BOMB = 'encdbg=bomberRun&room=hangar&sector=4';
const P2A3_KEYS = ['p2a3-cell-0', 'p2a3-cell-1', 'p2a3-cell-2', 'p2a3-cell-3', 'p2a3-cell-hot', 'p2a3-hud-burst', 'p2a3-hud-override', 'p2a3-hud-standard'];
const ONLY = opt('only', '') ? new Set(opt('only', '').split(',').map(Number)) : null;
const on = (n) => !ONLY || ONLY.has(n);

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`); };
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const isB = (flags) => /fxPilot=p2a3/.test(flags) && /polish=p1/.test(flags) && /visualPilot=v2c/.test(flags);

async function instrument(p, flags) {
  await p.evaluate(async ({ self, b }) => {
    const gs = window.__gs, hud = window.game.scene.getScene('HUD');
    const fnv = (str) => { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0; return h; };
    window.__dbg = await window.__mod(/systems\/debug\.js/);
    window.__fxmod = await window.__mod(/systems\/FX\.js/);
    window.__WP = (await window.__mod(/entities\/WeaponPickup\.js/))?.WeaponPickup;
    if (self && b) {
      const X = gs._p2a.p2a3;
      const u = X.update.bind(X); X.update = (dt, rd) => { Math.random(); u(dt, rd); };                          // a draw in the frame
      const u2 = X.update; X.update = (dt, rd) => { const n = X.stats.polls; u2(dt, rd); if (X.stats.polls > n) gs.events.emit('secondary-ammo-changed'); };   // an event per redraw
      const dc = X._drawCell.bind(X); X._drawCell = (dt) => { dc(dt); if (X.cell.visible) X.cell.x += 1; };       // the cell off the rifle by 1px
    }
    // the HUD bar's fill width, as the shipped refresh draws it (its last 8px-tall rounded rect)
    window.__bar = null;
    const fr = hud.secGfx.fillRoundedRect.bind(hud.secGfx);
    hud.secGfx.fillRoundedRect = (x, y, w, h, r) => { if (h === 8) window.__bar = w; return fr(x, y, w, h, r); };
    // every game event emitted, by name
    window.__ev = {};
    const em = gs.events.emit.bind(gs.events);
    gs.events.emit = (n, ...a) => { window.__ev[n] = (window.__ev[n] || 0) + 1; return em(n, ...a); };
    window.__texHash = (key) => {
      const src = window.game.textures.get(key).getSourceImage();
      if (!src || !src.width) return 'n/a';
      const cv = document.createElement('canvas'); cv.width = src.width; cv.height = src.height;
      const c2 = cv.getContext('2d'); c2.drawImage(src, 0, 0);
      const d = c2.getImageData(0, 0, cv.width, cv.height).data;
      let h1 = 0x811c9dc5, h2 = 0x1000193;
      for (let i = 0; i < d.length; i++) { h1 = Math.imul(h1 ^ d[i], 16777619) >>> 0; h2 = Math.imul(h2 + d[i] * (i % 251 + 1), 2654435761) >>> 0; }
      return `${cv.width}x${cv.height}:${h1.toString(16)}${h2.toString(16)}`;
    };
    window.__alpha = (key) => {
      const src = window.game.textures.get(key).getSourceImage();
      const cv = document.createElement('canvas'); cv.width = src.width; cv.height = src.height;
      const c2 = cv.getContext('2d'); c2.drawImage(src, 0, 0);
      const d = c2.getImageData(0, 0, cv.width, cv.height).data, a = [];
      for (let i = 3; i < d.length; i += 4) a.push(d[i]);
      return { w: cv.width, h: cv.height, a };
    };
    window.__allTex = () => {
      const out = {};
      for (const k of Object.keys(window.game.textures.list).sort()) {
        if (k.startsWith('__') || /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(k) || k.startsWith('backdrop-') || k.startsWith('hashbg-')) continue;
        out[k] = window.__texHash(k);
      }
      return out;
    };
    window.__clearArena = () => {
      gs.arenaActive = false; gs._spawnQueue = [];
      gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
      gs._roomModifier = null;
      for (const g of [...gs.hostileBullets, gs.playerBullets, gs.playerRifleBullets]) for (const bb of g.getChildren()) if (bb.active) bb.kill();
      (gs.weaponPickups || []).forEach((q) => q.destroy()); gs.weaponPickups = []; gs._pendingChoice = null;
    };
    window.__stage = (x, y) => {
      window.__clearArena();
      window.__headless = true; window.__adv(300); window.__headless = false;
      window.__clearArena();
      const P = gs.player; P.x = x; P.y = y; P.body.reset(x, y); P.fireCooldown = 0; P.ammo = 99; P.secondary = null; P.secondaryAmmo = 0;
      gs.events.emit('secondary-equipped', null);
      window.__adv(30);
    };
    window.__view = () => {
      const v = gs._p2a?.loadout?.view;
      return v ? `${v.texture.key},${v.x.toFixed(3)},${v.y.toFixed(3)},${v.rotation.toFixed(4)},${v.flipY},${v.depth},${v.alpha},${v.visible}` : 'none';
    };
    window.__hudState = () => {
      const h = hud, X = gs._p2a?.p2a3;
      return { icon: h.secIcon.texture.key, iconVis: h.secIcon.visible, iconScale: +h.secIcon.scaleX.toFixed(3), iconX: h.secIcon.x, iconY: h.secIcon.y,
        text: h.secText.text, font: h.secText.style.fontSize, textX: h.secText.x, textY: h.secText.y, textH: h.secText.height, cx: h._secX, cy: h._secY,
        label: X?.h?.label?.visible ? [X.h.label.texture.key, X.h.label.x, X.h.label.y] : null,
        std: X?.h?.std?.visible ? +X.h.std.alpha.toFixed(2) : null, cuts: X?.h?.seg?.commandBuffer?.length ? (X.h.seg.commandBuffer.length - 3) / 5 : 0, segCmds: X?.h?.seg?.commandBuffer?.length || 0 };
    };
    // rerender the current state without stepping the game
    window.__rerender = () => { const g = window.game, r = g.renderer; r.preRender(); g.scene.render(r); r.postRender(); };
    window.__grab = (x, y, w, h) => new Promise((res) => {
      window.game.renderer.snapshotArea(x, y, w, h, (img) => {
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const c = cv.getContext('2d'); c.drawImage(img, 0, 0); res(c.getImageData(0, 0, w, h).data);
      });
      window.__rerender();
    });
    window.__trace = ({ seed, ticks, seg, headless, melee, pickAt, clusterAt, superAt, low }) => {
      const P = gs.player, K = gs.keys, cam = gs.cameras.main;
      window.__headless = headless;
      if (low) window.__fxmod.setLowQuality(true);
      window.__seed(seed); window.__draws = 0;
      const hashes = [];
      const f = (v) => (Math.round(v * 1000) / 1000).toString();
      for (let i = 0; i < ticks; i++) {
        const cur = seg.find(([a, bb]) => i >= a && i < bb)[2];
        K.A.isDown = cur.includes('A'); K.D.isDown = cur.includes('D'); K.W.isDown = cur.includes('W'); K.S.isDown = cur.includes('S');
        if (i >= 60 && i % 7 === 0) P.keyboardFire();
        if (superAt.includes(i)) { P.superCharge = 999; P.tryFireSuper(P._autoAimAngle()); }
        if (superAt.map((s) => s - 120).includes(i)) P.superCharge = 999;
        if (melee.includes(i)) { P.meleeCharge = 99; P.tryMeleeCombo(); }
        if (i === pickAt) gs.weaponPickups.push(new window.__WP(gs, P.x, P.y, 'rifle'));
        if (i === clusterAt) gs.weaponPickups.push(new window.__WP(gs, P.x, P.y, 'cluster'));
        window.__adv(1);
        let s = `${i}|${f(P.x)},${f(P.y)},${P.hp},${f(P.body.center.x)},${f(P.body.center.y)},${P.superCharge},${P.meleeCharge},${P.ammo},${P.secondary},${P.secondaryAmmo},${P.fireCooldown},${P._burstRemaining}|${f(cam.scrollX)},${f(cam.scrollY)},${f(cam.zoom)}|${f(gs.time.timeScale)}|`;
        for (const e of gs.enemies.getChildren()) if (e.active) s += `${e.enemyType}:${f(e.x)},${f(e.y)},${Math.round(e.hp)},${f(e.body.center.x)},${f(e.body.center.y)};`;
        for (const g of [...gs.hostileBullets, gs.playerBullets, gs.playerRifleBullets, gs.playerSuperBullets]) {
          for (const bb of g?.getChildren?.() || []) if (bb.active) s += `b${f(bb.x)},${f(bb.y)},${f(bb.body.velocity.x)},${f(bb.body.velocity.y)},${bb.damage};`;
        }
        for (const q of gs.weaponPickups || []) s += `w${q.weaponId}:${q.active}:${f(q.x)},${f(q.y)};`;
        s += `|d${window.__draws}`;
        hashes.push(fnv(s));
      }
      const K2 = gs.keys; K2.A.isDown = K2.D.isDown = K2.W.isDown = K2.S.isDown = false;
      if (low) window.__fxmod.setLowQuality(false);
      const X = gs._p2a?.p2a3;
      return { hashes, draws: window.__draws, styles: gs._p2a ? { ...gs._p2a.stats.styles } : null, x: X ? { ...X.stats } : null, ev: { ...window.__ev } };
    };
  }, { self: SELF, b: isB(flags) });
}
async function boot(flags, { base = NOW, q = 'room=hangar', seed = 4242, viewport } = {}) {
  const p = await bootPage(browser, { base, flags, baseline: null, q, seed, viewport });
  await instrument(p, flags);
  return p;
}
const firstDiff = (a, b) => { const n = Math.max(a.length, b.length); for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i; return -1; };

// ── 0. THE FLAGS ──────────────────────────────────────────────────────────
if (on(0)) {
  console.log('\n== 0. the flags');
  // [flags, P2-A3, P2-A2 loadout, P2-A layer, P1, sharp]
  const cases = [['', 0, 0, 0, 0, 0], ['fxPilot=p2a3', 0, 0, 0, 0, 0], ['visualPilot=v2c&fxPilot=p2a3', 0, 0, 0, 0, 0],
    ['visualPilot=v2b&polish=p1&fxPilot=p2a3', 0, 0, 0, 0, 0], [P1, 0, 0, 0, 1, 0], [A2, 0, 1, 1, 1, 0], [B, 1, 1, 1, 1, 1], [BS, 1, 1, 1, 1, 1], [BC, 1, 1, 1, 1, 0],
    [`${A2}&muzzle=sharp`, 0, 1, 1, 1, 0], [`${A2}&muzzle=current`, 0, 1, 1, 1, 0], [`${A}&muzzle=sharp`, 0, 0, 1, 1, 0], [`${P1}&muzzle=sharp`, 0, 0, 0, 1, 0], ['muzzle=sharp', 0, 0, 0, 0, 0],
    [`${B}&muzzle=SHARP`, 1, 1, 1, 1, 1], [`${B}&muzzle=CURRENT`, 1, 1, 1, 1, 1], [`${B}&muzzle=soft`, 1, 1, 1, 1, 1], [`${P1}&fxPilot=P2A3`, 0, 0, 0, 1, 0], [`${P1}&fxPilot=p2a9`, 0, 0, 0, 1, 0],
    [`baseline=legacy&${BS}`, 1, 1, 1, 1, 1]];
  const sw = {};
  for (const [flags, w3, w2, wA, w1, wS] of cases) {
    const p = await boot(flags);
    const r = await p.evaluate(() => {
      const d = window.__dbg, gs = window.__gs;
      return { a3: d.isFxP2A3(), a2: d.isFxP2A2(), a: d.isFxP2A(), p1: d.isPolishP1(), sharp: d.isMuzzleSharp(),
        layer: !!gs._p2a, loadout: !!gs._p2a?.loadout, x: !!gs._p2a?.p2a3, ctlSharp: !!gs._p2a?.sharp, base: d.getGameplayBaseline(),
        sw: [d.isRosterV1(), d.isMoveV22(), d.isGaitV2(), d.getBulwarkStuck(), d.getMarksmanStuck(), d.isMarksmanAngle(), d.isBulwarkAngle()].join(',') };
    });
    const ok = r.a3 === !!w3 && r.x === !!w3 && r.a2 === !!w2 && r.loadout === !!w2 && r.a === !!wA && r.layer === !!wA && r.p1 === !!w1 && r.sharp === !!wS && r.ctlSharp === !!wS;
    check(`?${flags || '(no flags)'} -> P2-A3 ${w3 ? 'ON' : 'off'}${wS ? ' + SHARP' : ''}, P2-A2 loadout ${w2 ? 'on' : 'off'}, P2-A layer ${wA ? 'on' : 'off'}, P1 ${w1 ? 'on' : 'off'}`, ok, JSON.stringify(r));
    (sw[r.base] ||= new Set()).add(r.sw);
    await p.close();
  }
  check('the flags move none of the seven gameplay switches (per baseline)', Object.values(sw).every((s) => s.size === 1), JSON.stringify(Object.fromEntries(Object.entries(sw).map(([k, v]) => [k, [...v]]))));
}

// ── 1. TEXTURES ───────────────────────────────────────────────────────────
if (on(1)) {
  console.log('\n== 1. textures');
  const tex = async (flags) => { const p = await boot(flags); const t = await p.evaluate(() => window.__allTex()); await p.close(); return t; };
  const tA2 = await tex(A2), tB = await tex(B), tBS = await tex(BC);
  const changed = Object.keys(tA2).filter((k) => tA2[k] !== tB[k]);
  const added = Object.keys(tB).filter((k) => !(k in tA2)).sort();
  check(`B: every P2-A2 texture byte-identical (${Object.keys(tA2).length}: P1, p2a-*, p2a2-*, roster, pickups, \`bullet\`)`, changed.length === 0, changed.join(' '));
  check(`B: the added textures are exactly the ${P2A3_KEYS.length} p2a3-* keys`, JSON.stringify(added) === JSON.stringify(P2A3_KEYS), added.join(' '));
  const dS = [...new Set([...Object.keys(tB), ...Object.keys(tBS)])].filter((k) => tB[k] !== tBS[k]);
  check('BC (`muzzle=current`): every texture byte-identical to B — the A/B is persistence only', dS.length === 0, dS.join(' '));
  for (const [label, base, ign] of [['R1', '', 'fxPilot=p2a3'], ['P1', P1, `${P1}&fxPilot=p2a9`], ['P2-A2', A2, `${A2}&muzzle=sharp`]]) {
    const t0 = await tex(base), t1 = await tex(ign);
    const d = [...new Set([...Object.keys(t0), ...Object.keys(t1)])].filter((k) => t0[k] !== t1[k]);
    check(`${label} + ignored ${ign.split('&').pop()}: every texture byte-identical, no p2a3 key`, d.length === 0 && !Object.keys(t1).some((k) => k.startsWith('p2a3-')), d.join(' '));
  }
}

// ── 2. INSTALL ────────────────────────────────────────────────────────────
const installState = (p) => p.evaluate(() => {
  const gs = window.__gs, ev = gs.events, hud = window.game.scene.getScene('HUD'), X = gs._p2a?.p2a3;
  const out = {};
  for (const n of ev.eventNames()) out[String(n)] = ev.listenerCount(n);
  return { game: out, wraps: gs._p2a?._wrapped?.length ?? 0, hudOwn: Object.prototype.hasOwnProperty.call(hud, 'refreshSecondary'),
    world: X ? [X.cell, X.glow, X.ring].map((o) => `${gs.children.list.includes(o)}:${o.visible}`).join(',') : null,
    hudObjs: hud.children.list.filter((o) => o.texture?.key?.startsWith?.('p2a3-')).length, tweens: gs.tweens.getTweens().length };
});
if (on(2)) {
  console.log('\n== 2. install');
  const pA = await boot(A2), pB = await boot(B);
  const lA = await installState(pA), lB = await installState(pB);
  const ev = [...new Set([...Object.keys(lA.game), ...Object.keys(lB.game)])];
  const diff = ev.filter((k) => (lA.game[k] || 0) !== (lB.game[k] || 0));
  check('B adds no game-event listener to P2-A2\'s (P2-A3 polls in P2-A\'s own frame)', diff.length === 0, diff.join(' '));
  check('B keeps P2-A2\'s thirteen wrappers and its HUD instance wrapper (P2-A3 wraps that one in turn)', lB.wraps === 13 && lA.wraps === 13 && lB.hudOwn && lA.hudOwn, JSON.stringify({ a: lA.wraps, b: lB.wraps }));
  check('B: the cell, its glow and the engage ring in the display list, hidden at rest; no P2-A3 HUD object before OVERRIDE; no tween', lB.world === 'true:false,true:false,true:false' && lB.hudObjs === 0 && lB.tweens === lA.tweens, JSON.stringify({ world: lB.world, hud: lB.hudObjs, tweens: [lA.tweens, lB.tweens] }));
  const r = await pB.evaluate(() => {
    const gs = window.__gs, P = gs.player, hud = window.game.scene.getScene('HUD'), X = gs._p2a.p2a3, L = gs._p2a.loadout;
    const n2 = L.stats.hud, n3 = X.stats.hud;
    P.equipSecondary('rifle'); window.__adv(1);
    const own = ['label', 'std', 'seg', 'rim'].map((k) => !!X.h[k] && hud.children.list.includes(X.h[k]));
    return { l: L.stats.hud - n2, x: X.stats.hud - n3, own, icon: hud.secIcon.texture.key };
  });
  check('one refresh runs the shipped panel, then P2-A2\'s restyle, then P2-A3\'s (both counted, P2-A3\'s last: the icon is the burst symbol); its four HUD objects are built on first use', r.l >= 1 && r.x >= 1 && r.own.every(Boolean) && r.icon === 'p2a3-hud-burst', JSON.stringify(r));
  await pA.close(); await pB.close();
}

// ── 3. THE ROUND COUNT ────────────────────────────────────────────────────
// a REAL module pickup, then bursts until it runs dry, then ordinary fire
async function overrideRun(flags, { aim = -0.2, after = 30 } = {}) {
  const p = await boot(flags);
  const r = await p.evaluate(({ aim, after }) => {
    const gs = window.__gs, P = gs.player, hud = window.game.scene.getScene('HUD'), X = gs._p2a?.p2a3;
    window.__stage(760, 820); window.__seed(91); window.__draws = 0; window.__ev = {};
    let refreshes = 0;
    const rs = hud.refreshSecondary; hud.refreshSecondary = (id) => { refreshes++; return rs.call(hud, id); };
    gs.weaponPickups.push(new window.__WP(gs, P.x, P.y, 'rifle'));
    const rows = [];
    let emptyAt = -1;
    for (let i = 0; i < 700; i++) {
      if (i >= 20) P.tryFire(aim);
      window.__adv(1);
      const h = window.__hudState();
      rows.push({ i, sec: P.secondary, ammo: P.secondaryAmmo, burst: P._burstRemaining, text: h.text, bar: window.__bar, view: window.__view(), hud: h,
        cell: X?.cell?.visible ? `${X.cell.texture.key}@${X.cell.alpha.toFixed(3)}` : null, mode: X?.mode || null, ring: !!X?.ring?.visible,
        cellXf: X?.cell?.visible ? [X.cell.x, X.cell.y, X.cell.rotation, X.cell.flipY, X.cell.originX, X.cell.originY, +(X.cell.depth - gs._p2a.loadout.view.depth).toFixed(4)].join() : null,
        viewXf: gs._p2a?.loadout ? (() => { const v = gs._p2a.loadout.view; return [v.x, v.y, v.rotation, v.flipY, v.originX, v.originY].join(); })() : null });
      if (emptyAt < 0 && i > 25 && P.secondary !== 'rifle') emptyAt = i;
      if (emptyAt >= 0 && i >= emptyAt + after + 80) break;
    }
    hud.refreshSecondary = rs;
    return { rows, emptyAt, refreshes, ev: { ...window.__ev }, draws: window.__draws, x: X ? { ...X.stats } : null };
  }, { aim, after });
  await p.close();
  return r;
}
let OV = null;
const overrideRuns = async () => (OV ||= { a2: await overrideRun(A2), b: await overrideRun(B) });
if (on(3)) {
  console.log('\n== 3. the round count (refinement 1)');
  const { a2, b } = await overrideRuns();
  const live = (r) => r.rows.filter((x) => x.sec === 'rifle');
  const badB = live(b).filter((x) => x.text !== String(x.ammo) || Math.abs(x.bar - (76 * x.ammo) / 27) > 1e-9);
  check(`B: on every one of ${live(b).length} OVERRIDE ticks the HUD count and bar equal secondaryAmmo (27 -> 1, the bar 76 x ammo / 27)`, badB.length === 0 && live(b).length > 100 && live(b).some((x) => x.ammo === 1),
    badB.slice(0, 3).map((x) => `tick ${x.i}: ammo ${x.ammo}, text "${x.text}", bar ${x.bar}`).join('; '));
  const staleA2 = live(a2).filter((x) => !x.text.endsWith(` ${x.ammo}`) || Math.abs(x.bar - (76 * x.ammo) / 27) > 1e-9);
  check(`CONTROL: P2-A2 (the shipped behaviour) shows a stale count/bar on ${staleA2.length} of ${live(a2).length} OVERRIDE ticks — the check can see the defect`, staleA2.length > live(a2).length / 2,
    staleA2.slice(0, 2).map((x) => `ammo ${x.ammo} "${x.text}" bar ${x.bar?.toFixed(1)}`).join('; '));
  const mech = (r) => r.rows.map((x) => `${x.i}:${x.sec}:${x.ammo}:${x.burst}`).join('|');
  check(`the shots, burst counter, ammunition, the tick it runs dry (${b.emptyAt}) and the draw count are P2-A2's`, mech(a2) === mech(b) && a2.emptyAt === b.emptyAt && a2.draws === b.draws, `draws ${a2.draws}/${b.draws}, dry ${a2.emptyAt}/${b.emptyAt}`);
  const evs = [...new Set([...Object.keys(a2.ev), ...Object.keys(b.ev)])].filter((k) => a2.ev[k] !== b.ev[k]);
  check(`no event added or removed: every game event emitted the same number of times (secondary-ammo-changed ${b.ev['secondary-ammo-changed']}, secondary-equipped ${b.ev['secondary-equipped']}, player-fire-rifle ${b.ev['player-fire-rifle']})`, evs.length === 0, evs.map((k) => `${k} ${a2.ev[k]}/${b.ev[k]}`).join(' '));
  const changes = live(b).filter((x, k, arr) => k > 0 && x.ammo !== arr[k - 1].ammo).length;
  check(`redrawn only when the value changes: ${b.x.polls} poll redraws for ${changes} value changes during OVERRIDE (the emptying round goes through the shipped event); HUD refreshes ${a2.refreshes} -> ${b.refreshes}`,
    b.x.polls === changes && changes === 26 && b.refreshes === a2.refreshes + changes, JSON.stringify({ polls: b.x.polls, changes }));
}

// ── 4. THE READOUT ────────────────────────────────────────────────────────
if (on(4)) {
  console.log('\n== 4. the readout (refinement 2)');
  const { a2, b } = await overrideRuns();
  const s = b.rows.find((x) => x.sec === 'rifle' && x.i > 30).hud;
  const s2 = a2.rows.find((x) => x.sec === 'rifle' && x.i > 30).hud;
  check('B, OVERRIDE: the three-round symbol (p2a3-hud-burst) at full size at the top of the panel, the count alone in the HUD\'s own type at 32px, the mode\'s name under the panel',
    s.icon === 'p2a3-hud-burst' && s.iconVis && s.iconScale === 1 && s.iconY === s.cy - 29 && s.font === '32px' && /^\d+$/.test(s.text) && s.textY === s.cy + 7 && s.label?.[0] === 'p2a3-hud-override' && s.label[2] === s.cy + 49, JSON.stringify(s));
  check(`B: the count is the panel's largest type — ${s.textH}px tall vs P2-A2's ${s2.textH}px "${s2.text}" caption line`, s.textH >= 1.8 * s2.textH, `${s.textH} / ${s2.textH}`);
  check('B: the bar is cut every three rounds — eight cuts, one segment per trigger pull', s.cuts === 8, JSON.stringify({ cuts: s.cuts, cmds: s.segCmds }));
  const pop = b.rows.filter((x) => x.sec === 'rifle').slice(0, 20).map((x) => x.hud.iconScale);
  check('B, engage: the symbol pops (1.35 -> 1 over 260ms) and settles at 1', pop[0] > 1.2 && pop.at(-1) === 1 && pop.every((v, k) => k === 0 || v <= pop[k - 1]), pop.join(','));
  const dry = b.rows.filter((x) => x.i >= b.emptyAt);
  const stdOn = dry.filter((x) => x.hud.std != null);
  check(`B, run dry: the panel clears as shipped and STANDARD is shown where it was for ${stdOn.length} ticks (1100ms), fading over its last 380ms, then gone`, dry[0].hud.std === 1 && !dry[0].hud.iconVis && dry[0].hud.text === '' && stdOn.length >= 64 && stdOn.length <= 67 && dry.at(-1).hud.std == null && dry[0].hud.label == null,
    JSON.stringify({ first: dry[0].hud.std, n: stdOn.length, last: dry.at(-1).hud.std }));
  check('B, back in STANDARD: the shipped secText size restored (15px)', dry.at(-1).hud.font === '15px', dry.at(-1).hud.font);
  // the cluster pod after OVERRIDE: the shipped panel, pixel for pixel, and no STANDARD tag
  const cl = async (flags) => {
    const p = await boot(flags);
    const r = await p.evaluate(async () => {
      const gs = window.__gs, P = gs.player, hud = window.game.scene.getScene('HUD');
      window.__stage(760, 820); window.__seed(31); window.__draws = 0;
      P.equipSecondary('rifle'); window.__adv(2);
      for (let i = 0; i < 24; i++) { P.tryFire(0.2); window.__adv(1); }
      gs.weaponPickups.push(new window.__WP(gs, P.x, P.y, 'cluster')); window.__adv(3);
      const tag = window.__hudState().std;
      window.__adv(90);
      const h = window.__hudState();
      const px = await window.__grab(hud._secX - 64, hud._secY - 60, 128, 124);
      let hsh = 0x811c9dc5; for (let i = 0; i < px.length; i++) hsh = Math.imul(hsh ^ px[i], 16777619) >>> 0;
      return { h, tag, px: hsh.toString(16), sec: P.secondary };
    });
    await p.close();
    return r;
  };
  const c2 = await cl(A2), c3 = await cl(B);
  const shipped = (h) => JSON.stringify([h.icon, h.iconVis, h.iconScale, h.iconX, h.iconY, h.text, h.font, h.textX, h.textY]);
  check('B, OVERRIDE -> cluster pod: the shipped cluster panel (icon, 0.42, "CLUSTER", 15px), no OVERRIDE label or cuts, and no STANDARD tag (it is not STANDARD)',
    c3.sec === 'cluster' && shipped(c3.h) === shipped(c2.h) && c3.h.label == null && c3.h.cuts === 0 && c3.tag == null, `${shipped(c2.h)} / ${shipped(c3.h)} tag ${c3.tag}`);
  check('B, the cluster panel is P2-A2\'s pixel for pixel (a 128x124 grab of the HUD)', c3.px === c2.px, `${c2.px} / ${c3.px}`);
}

// ── 5. THE ACTIVE STATE ───────────────────────────────────────────────────
if (on(5)) {
  console.log('\n== 5. the active state (refinement 3)');
  const { a2, b } = await overrideRuns();
  const dv = firstDiff(a2.rows.map((x) => x.view), b.rows.map((x) => x.view));
  check(`the carried rifle is P2-A2's object state on every one of ${b.rows.length} ticks (texture, position, rotation, flip, depth, alpha) — the same gun`, dv < 0 && b.rows.every((x) => /^p1-rifle/.test(x.view)), dv < 0 ? '' : `tick ${dv}: ${a2.rows[dv].view} / ${b.rows[dv].view}`);
  // the cell lights only pixels the rifle has
  const p = await boot(B);
  const cover = await p.evaluate((keys) => {
    const R = [window.__alpha('p1-rifle'), window.__alpha('p1-rifle-hot')], out = [];
    for (const k of keys) {
      const C = window.__alpha(k);
      let lit = 0, off = 0;
      for (let i = 0; i < C.a.length; i++) if (C.a[i] > 0) { lit++; if (R.some((r) => r.a[i] === 0) || C.w !== R[0].w || C.h !== R[0].h) off++; }
      out.push(`${k}:${lit}/${off}`);
    }
    return out;
  }, P2A3_KEYS.filter((k) => k.startsWith('p2a3-cell')));
  check('every lit texel of the five cell textures lands on an opaque texel of p1-rifle AND p1-rifle-hot (same 72x40 canvas): the silhouette never grows', cover.every((c) => /:\d+\/0$/.test(c) && !/:0\//.test(c)), cover.join(' '));
  // rides the rifle at 8 aims, during OVERRIDE
  const ride = await p.evaluate(() => {
    const gs = window.__gs, P = gs.player, X = gs._p2a.p2a3, v = gs._p2a.loadout.view;
    window.__stage(760, 820); P.equipSecondary('rifle'); window.__adv(30);
    const out = [];
    for (const a of [0, 0.785, 1.571, 2.356, 3.1416, -2.356, -1.571, -0.785]) {
      P.facing = a; P.aim = a; window.__adv(2);
      out.push({ a, ok: X.cell.visible && X.cell.x === v.x && X.cell.y === v.y && X.cell.rotation === v.rotation && X.cell.flipY === v.flipY && X.cell.originX === v.originX && X.cell.originY === v.originY && Math.abs(X.cell.depth - v.depth - 0.02) < 1e-9 && X.cell.texture.key.startsWith('p2a3-cell') });
    }
    // mid-combo (the blade), dead, in a bush
    P.meleeCharge = 99; P.tryMeleeCombo(); window.__adv(2);
    const blade = { view: v.texture.key, cell: X.cell.visible };
    window.__adv(60);
    // BushSystem rewrites hiddenInBush every frame: pin it, as standing in a bush would
    Object.defineProperty(P, 'hiddenInBush', { get: () => true, set: () => {}, configurable: true }); window.__adv(2);
    const bush = { va: v.alpha, ca: X.cell.alpha };
    delete P.hiddenInBush; P.hiddenInBush = false; window.__adv(2);
    P.die(); window.__adv(3);
    const dead = { va: v.alpha, cell: X.cell.visible };
    return { out, blade, bush, dead };
  });
  check('the cell rides the rifle exactly at 8 aims (position, rotation, flip, origin; depth +0.02)', ride.out.every((x) => x.ok), ride.out.filter((x) => !x.ok).map((x) => x.a).join(','));
  check('mid-combo (the blade drawn) the cell is hidden; in a bush it fades with the rifle; dead, hidden', ride.blade.view === 'p1-blade' && !ride.blade.cell && Math.abs(ride.bush.ca - ride.bush.va) < 1e-9 && ride.bush.va < 1 && ride.dead.va === 0 && !ride.dead.cell, JSON.stringify(ride));
  await p.close();
  // when it shows
  const strayB = b.rows.filter((x) => x.cell && x.sec !== 'rifle' && x.mode === 'off');
  check('the cell shows only while OVERRIDE is engaged or in its run-dry beat — never in plain STANDARD', strayB.length === 0 && b.rows.some((x) => x.cell && x.sec === 'rifle'), `${strayB.length} stray ticks`);
  const eng = b.rows.filter((x) => x.sec === 'rifle').slice(0, 18);
  const keys = eng.slice(0, 14).map((x) => (x.cell || '-').split('@')[0].replace('p2a3-cell-', ''));
  const rings = eng.filter((x) => x.ring).length;
  check(`engage: the pips light in sequence (${keys.join(' ')}) and one amber ring leaves the cell for 300ms (${rings} frames)`, keys[0] === '0' && keys.includes('1') && keys.includes('2') && keys.at(-1) === '3' && rings >= 16 && rings <= 18 && !eng.at(-1).ring, keys.join(','));
  check(`one flick per round leaving: ${b.x.flicks} flicks, ${b.x.engages} engage, ${b.x.drains} run-dry`, b.x.flicks === 26 && b.x.engages === 1 && b.x.drains === 1, JSON.stringify(b.x));
  const lowA = b.rows.filter((x) => x.sec === 'rifle' && x.ammo <= 6 && x.cell && x.cell.startsWith('p2a3-cell-3')).map((x) => +x.cell.split('@')[1]);
  const highA = b.rows.filter((x) => x.sec === 'rifle' && x.ammo > 6 && x.cell && x.i > 40).map((x) => +x.cell.split('@')[1]);
  check(`the last two bursts pulse the cell (alpha ${Math.min(...lowA).toFixed(2)}..${Math.max(...lowA).toFixed(2)}); before that it is steady at 1`, Math.min(...lowA) < 0.8 && highA.every((a) => a === 1), `${lowA.length} low ticks`);
  const dry = b.rows.filter((x) => x.i >= b.emptyAt).slice(0, 30).map((x) => (x.cell ? x.cell.replace('p2a3-cell-', '').replace(/@(\d\.\d)\d+/, '@$1') : '-'));
  const offAt = b.rows.findIndex((x) => x.i >= b.emptyAt && x.mode === 'off') - b.rows.findIndex((x) => x.i >= b.emptyAt);
  check(`run dry: the pips go out 3 -> 0, the cell gutters twice and dies within 420ms (${offAt} ticks): ${dry.slice(0, 26).join(' ')}`, dry[0].startsWith('3') && dry.some((k) => k.startsWith('0')) && offAt > 0 && offAt <= 26 && b.rows.find((x) => x.i === b.emptyAt + 30).cell == null, dry.join(' '));
}

// ── 6. THE MUZZLE A/B ─────────────────────────────────────────────────────
// Sustained STANDARD fire in four states: the shipped ammo pool (3 rounds,
// 120ms cooldown, 520ms refill) under a held trigger. Per tick: every live
// STANDARD discharge's drawn state, and its visible INK (the frame rendered
// with vs without the discharges, in the muzzle's neighbourhood).
const MZ_STATES = { none: {}, shield: { shield: 1 }, ready: { ready: 1 }, both: { shield: 1, ready: 1 } };
async function muzzleRun(flags, { ticks = 66, step = 1000 / 60, ink = true } = {}) {
  const p = await boot(flags);
  const r = await p.evaluate(async ({ states, ticks, step, ink }) => {
    const gs = window.__gs, P = gs.player, c = gs._p2a, g = window.game;
    const adv = () => { window.__t += step; g.step(window.__t, step); };
    const out = {};
    for (const [sn, o] of Object.entries(states)) {
      window.__stage(760, 820);
      const set = () => { P.shieldHp = o.shield ? 50 : 0; P.superCharge = o.ready ? 99 : 0; };
      set(); for (let i = 0; i < 24; i++) adv();
      P.ammo = window.game.scene.getScene('HUD').ammoPips.length; P.ammoTimers = []; P.fireCooldown = 0;
      const rows = [];
      let shots = 0; const onFire = () => shots++;
      gs.events.on('player-fire', onFire);
      for (let i = 0; i < ticks; i++) {
        set(); P.tryFire(0.35); adv();
        const fl = c.flashes.filter((f) => f.kind === 'standard');
        const rec = fl.map((f) => [f.img.texture.key, f.img.visible, f.img.x.toFixed(2), f.img.y.toFixed(2), f.img.rotation.toFixed(4), f.img.scaleX.toFixed(4), f.img.scaleY.toFixed(4), f.img.alpha.toFixed(4), f.img.depth, f.glow ? `${f.glow.alpha.toFixed(4)}/${f.glow.scaleX.toFixed(4)}` : '-'].join(',')).join(' ');
        let px = 0;
        const front = fl.find((f) => f.img.visible);
        if (ink && front) {
          const cam = gs.cameras.main, wv = cam.worldView;
          const sx = (front.img.x - wv.x) * cam.zoom + cam.x, sy = (front.img.y - wv.y) * cam.zoom + cam.y;
          const R = 44, x0 = Math.round(sx - R), y0 = Math.round(sy - R);
          const withF = await window.__grab(x0, y0, 2 * R, 2 * R);
          const vis = c.flashes.map((f) => [f.img.visible, f.glow?.visible]);
          for (const f of c.flashes) { f.img.setVisible(false); f.glow?.setVisible(false); }
          const without = await window.__grab(x0, y0, 2 * R, 2 * R);
          c.flashes.forEach((f, k) => { f.img.setVisible(vis[k][0]); if (f.glow) f.glow.setVisible(vis[k][1]); });
          for (let q = 0; q < withF.length; q += 4) if (Math.abs(withF[q] - without[q]) + Math.abs(withF[q + 1] - without[q + 1]) + Math.abs(withF[q + 2] - without[q + 2]) > 60) px++;
        }
        rows.push({ i, shots, rec, ink: px, alphas: fl.filter((f) => f.img.visible).map((f) => +f.img.alpha.toFixed(3)), shield: P.shieldRing.visible, ring: gs._p1Player.ring.visible,
          front: fl.length ? fl.every((f) => (gs._p2a._weapon().depth >= P.depth ? f.img.depth > P.shieldRing.depth : f.img.depth < P.depth)) : true });
      }
      gs.events.off('player-fire', onFire);
      out[sn] = rows;
    }
    return { out, draws: window.__draws };
  }, { states: MZ_STATES, ticks, step, ink });
  await p.close();
  return r;
}
const shotStats = (rows) => {
  // per shot: the frames its discharge is drawn at alpha >= 0.15, and the ink on its first drawn frame
  const lit = [], first = [];
  let cur = null, last = 0;
  for (const x of rows) {
    if (x.shots > last) { if (cur) lit.push(cur.n); cur = { n: 0 }; first.push(x.ink); last = x.shots; }
    if (cur && x.alphas.some((a) => a >= 0.15)) cur.n++;
  }
  if (cur) lit.push(cur.n);
  const inked = rows.filter((x) => x.ink > 100).length;
  return { shots: last, lit: lit.length ? (lit.reduce((a, b) => a + b, 0) / lit.length) : 0, litMax: Math.max(0, ...lit), firstInk: first.length ? Math.round(first.reduce((a, b) => a + b, 0) / first.length) : 0,
    duty: +(inked / rows.length).toFixed(2), meanInk: Math.round(rows.reduce((a, x) => a + x.ink, 0) / rows.length) };
};
if (on(6)) {
  console.log('\n== 6. the STANDARD discharge A/B (refinement 4)');
  const m2 = await muzzleRun(A2), m3 = await muzzleRun(BC), mS = await muzzleRun(B);
  const same = Object.keys(MZ_STATES).every((s) => m2.out[s].map((x) => x.rec).join('|') === m3.out[s].map((x) => x.rec).join('|'));
  check('BC (`muzzle=current`): the STANDARD discharge is P2-A2\'s on every frame of sustained fire in 4 states (texture, position, rotation, scale, alpha, depth, glow)', same && m3.out.none.some((x) => x.rec));
  const peakOk = Object.keys(MZ_STATES).every((s) => {
    const firstOf = (rows) => { const o = []; let last = 0; for (const x of rows) if (x.shots > last) { o.push(x.rec.split(' ').at(-1).split(',')); last = x.shots; } return o; };
    const c = firstOf(m3.out[s]), k = firstOf(mS.out[s]);
    return c.length === k.length && c.every((r, i) => r[0] === k[i][0] && r[0] === 'p2a2-mz-s' && r[2] === k[i][2] && r[3] === k[i][3] && r[4] === k[i][4] && r[5] === k[i][5] && r[8] === k[i][8] && +k[i][7] === 1);
  });
  check('B (sharp, the approved default): on the first frame each shot is seen, the same texture (p2a2-mz-s), position, rotation, full size and depth as the current discharge, at full alpha', peakOk);
  check('B (sharp): the depth rule holds on every frame in every state (over the shield bubble in front of the body, under the body behind it)', Object.values(mS.out).every((rows) => rows.every((x) => x.front)));
  const tab = Object.keys(MZ_STATES).map((s) => { const c = shotStats(m3.out[s]), k = shotStats(mS.out[s]); return { s, c, k }; });
  for (const { s, c, k } of tab) {
    check(`${s.padEnd(6)} ${c.shots} shots: lit frames/shot ${c.lit.toFixed(1)} -> ${k.lit.toFixed(1)}; first-frame ink ${c.firstInk} -> ${k.firstInk} px; frames with ink ${Math.round(c.duty * 100)}% -> ${Math.round(k.duty * 100)}%; mean ink/frame ${c.meanInk} -> ${k.meanInk}`,
      c.shots === k.shots && c.shots >= 5 && k.lit <= c.lit / 1.5 && k.firstInk >= 0.9 * c.firstInk && k.duty < c.duty, JSON.stringify({ c, k }));
  }
  // a 30 Hz step (a phone that cannot hold 60): is each shot's PEAK ever drawn?
  const q2 = await muzzleRun(A2, { step: 1000 / 30, ticks: 34, ink: false }), qS = await muzzleRun(B, { step: 1000 / 30, ticks: 34, ink: false });
  const peak = (rows) => { let last = 0, n = 0, full = 0; for (const x of rows) if (x.shots > last) { last = x.shots; n++; if (x.alphas.some((a) => a >= 0.999)) full++; } return `${full}/${n}`; };
  const litQ = (rows) => shotStats(rows).lit.toFixed(1);
  check(`at a 30 Hz step: shots drawn at full alpha on their first frame — current ${peak(q2.out.none)}, sharp ${peak(qS.out.none)}; lit frames/shot ${litQ(q2.out.none)} -> ${litQ(qS.out.none)}`, peak(qS.out.none).split('/')[0] === peak(qS.out.none).split('/')[1]);
}

// ── 7. SAME FIGHT ─────────────────────────────────────────────────────────
const SUPER = [700, 1400], MELEE = [320, 345, 370, 1000, 1030], PICK = 480, CLUSTER = 1150;
async function replay(flags, q, { headless = true, ticks = TICKS, seed = 9071, base = NOW, low = false } = {}) {
  const p = await boot(flags, { base, q });
  const r = await p.evaluate((o) => window.__trace(o), { seed, ticks, seg: FIGHT_SEG, headless, melee: MELEE, pickAt: PICK, clusterAt: CLUSTER, superAt: SUPER, low });
  await p.close();
  return r;
}
if (on(7)) {
  console.log('\n== 7. same fight');
  for (const [label, q, base] of [['SWARM TIDE, production', Q_SWARM, ''], ['SWARM TIDE, legacy baseline', Q_SWARM, 'baseline=legacy'], ['CROSSFIRE, production', Q_CROSS, ''], ['BOMBER RUN, production', Q_BOMB, '']]) {
    const a = await replay([base, A2].filter(Boolean).join('&'), q);
    for (const [nm, fl] of [['B (sharp)', B], ['BC (current)', BC]]) {
      const b = await replay([base, fl].filter(Boolean).join('&'), q);
      const d = firstDiff(a.hashes, b.hashes);
      const ran = (b.styles?.override || 0) > 0 && (b.styles?.standard || 0) > 0 && b.x?.engages >= 1 && b.x?.flicks > 0;
      const evs = Object.keys({ ...a.ev, ...b.ev }).filter((k) => a.ev[k] !== b.ev[k]);
      check(`${label}: ${TICKS} headless ticks, ${nm} identical to P2-A2 (state, burst counter, pickups, ammo, draws, events; a real OVERRIDE pickup and a cluster pod)`, d < 0 && ran && evs.length === 0,
        d < 0 ? `${a.draws} draws; ${b.x?.engages} engage, ${b.x?.flicks} flicks, ${b.x?.polls} count redraws` : `first divergent tick ${d}${evs.length ? `; events ${evs.join(',')}` : ''}`);
    }
  }
  {
    const p1 = await replay(P1, Q_SWARM), b = await replay(B, Q_SWARM);
    const d = firstDiff(p1.hashes, b.hashes);
    check(`SWARM TIDE, production: ${TICKS} ticks, B identical to P1`, d < 0, d < 0 ? `${p1.draws} draws` : `first divergent tick ${d}`);
  }
  const n = Math.min(TICKS, 600);
  const a = await replay(A2, Q_SWARM, { headless: false, ticks: n }), b = await replay(BS, Q_SWARM, { headless: false, ticks: n });
  const d = firstDiff(a.hashes, b.hashes);
  check(`SWARM TIDE, production: ${n} RENDERED ticks, BS identical to P2-A2`, d < 0 && (b.styles.override || 0) > 0, d < 0 ? `${a.draws} draws` : `first divergent tick ${d}`);
  const al = await replay(A2, Q_CROSS, { headless: false, ticks: n, low: true }), bl = await replay(B, Q_CROSS, { headless: false, ticks: n, low: true });
  const dl = firstDiff(al.hashes, bl.hashes);
  check(`CROSSFIRE in LOW quality: ${n} rendered ticks, B identical to P2-A2`, dl < 0, dl < 0 ? `${al.draws} draws` : `first divergent tick ${dl}`);
  {
    const m = Math.min(TICKS, 800);
    const x = await replay('', Q_SWARM, { ticks: m }), y = await replay('fxPilot=p2a3&muzzle=sharp', Q_SWARM, { ticks: m });
    const dd = firstDiff(x.hashes, y.hashes);
    check(`R1 + ignored fxPilot=p2a3&muzzle=sharp: ${m} ticks identical to R1`, dd < 0, dd < 0 ? '' : `first divergent tick ${dd}`);
  }
}

// ── 8. READER ONLY ────────────────────────────────────────────────────────
if (on(8)) {
  console.log('\n== 8. reader only');
  const p = await boot(B, { q: Q_SWARM });
  const r = await p.evaluate(() => {
    const gs = window.__gs, P = gs.player, X = gs._p2a.p2a3;
    let inside = 0, wrote = 0, emitted = 0;
    const u = X.update.bind(X);
    const snap = () => [P.secondary, P.secondaryAmmo, P._burstRemaining, P._burstTimer, P._burstAngle, P.ammo, P.ammoTimers.join('/'), P.fireCooldown, P.x, P.y, P.facing, P.aim, P.superCharge, P.body.velocity.x, P.hp, gs.time.timeScale].join();
    X.update = (dt, rd) => { const s0 = snap(), d0 = window.__draws, e0 = Object.values(window.__ev).reduce((a, b) => a + b, 0); u(dt, rd); inside += window.__draws - d0; emitted += Object.values(window.__ev).reduce((a, b) => a + b, 0) - e0; if (snap() !== s0) wrote++; };
    window.__seed(5); window.__draws = 0;
    for (let i = 0; i < 500; i++) {
      if (i % 5 === 0) P.keyboardFire();
      if (i === 150 || i === 380) gs.weaponPickups.push(new window.__WP(gs, P.x, P.y, 'rifle'));
      window.__adv(1);
    }
    return { inside, wrote, emitted, x: { ...X.stats } };
  });
  await p.close();
  check(`the P2-A3 frame (count redraws, cell, beats, HUD restyle) draws no Math.random over 500 ticks with two OVERRIDE pickups (${JSON.stringify(r.x)})`, r.inside === 0 && r.x.polls > 0 && r.x.engages >= 1, `${r.inside} draws`);
  check('the P2-A3 frame emits no game event and writes no player or clock field (secondary, ammo, burst counter/timer/angle, refill timers, cooldown, position, aim, Super, velocity, hp, time scale)', r.wrote === 0 && r.emitted === 0, `${r.wrote} frames wrote, ${r.emitted} events`);
}

// ── 9. BUDGET + LOW QUALITY ───────────────────────────────────────────────
if (on(9)) {
  console.log('\n== 9. budget + low quality');
  const p = await boot(B, { q: Q_SWARM });
  const r = await p.evaluate(() => {
    const gs = window.__gs, P = gs.player, X = gs._p2a.p2a3, hud = window.game.scene.getScene('HUD');
    const count = () => gs.children.list.length + hud.children.list.length;
    const cycle = () => { P.equipSecondary('rifle'); for (let i = 0; i < 260 && P.secondary === 'rifle'; i++) { P.tryFire(0.1); window.__adv(1); } window.__adv(90); };
    cycle(); const o0 = count(); for (let k = 0; k < 3; k++) cycle(); const o1 = count();
    window.__fxmod.setLowQuality(true);
    P.equipSecondary('rifle');
    let glow = 0, ring = 0, cell = 0;
    for (let i = 0; i < 80; i++) { if (i > 20) P.tryFire(0.1); window.__adv(1); if (X.glow.visible) glow++; if (X.ring.visible) ring++; if (X.cell.visible) cell++; }
    window.__fxmod.setLowQuality(false);
    return { o0, o1, glow, ring, cell, x: { ...X.stats } };
  });
  check(`four engage -> run-dry cycles: no display object accumulates in the Game or HUD scene (${r.o0} -> ${r.o1})`, r.o1 <= r.o0 + 2 && r.x.engages >= 4, JSON.stringify(r));
  check('low quality: the cell is drawn; its glow and the engage ring are not', r.cell > 0 && r.glow === 0 && r.ring === 0, JSON.stringify(r));
  await p.close();
}

// ── 10. FROZEN FILES ──────────────────────────────────────────────────────
if (on(10)) {
  console.log('\n== 10. frozen files');
  let diff = '';
  try { diff = execSync(`git diff --stat ${BASE_REV} -- src ':!src/systems/debug.js' ':!src/systems/p2aFx.js' ':!src/systems/p2aPaint.js' ':!src/systems/p2a3Override.js'`, { encoding: 'utf8' }).trim(); } catch (e) { diff = `git failed: ${e.message}`; }
  check(`src/: nothing changed against ${BASE_REV} outside debug.js, p2aFx.js, p2aPaint.js and the new p2a3Override.js (P2-A2's p2a2Loadout.js, entities, Player, WeaponPickup, HUD, GameScene, PreloadScene, P1, FX, config untouched)`, diff === '', diff);
  let rem = '';
  try { rem = execSync(`git diff -U0 ${BASE_REV} -- src/systems/p2aPaint.js`, { encoding: 'utf8' }); } catch (e) { rem = e.message; }
  const removed = rem.split('\n').filter((l) => l.startsWith('-') && !l.startsWith('---'));
  check('p2aPaint.js: P2-A3 only ADDS (one import name, one paint call, its own painters); no P2-A / P2-A2 painter line changed', removed.length === 1 && /import \{ isFxP2A, isFxP2A2 \}/.test(removed[0]), removed.join(' | '));
  const g = enemyJsGuard(process.cwd() + '/');
  check('Enemy.js guard (outside the Bomber, the Bomber-only veto)', g.outside && g.bomberOnlyVeto && g.vetoCode, g.detail);
}

// ── 11. AGAINST THE PREVIOUS BUILD ────────────────────────────────────────
if (OLD && !SELF && on(11)) {
  console.log(`\n== 11. against the previous build (${OLD})`);
  for (const [label, flags] of [['R1 (no flags)', ''], ['V2C', 'visualPilot=v2c'], ['P1', P1], ['P2-A', A], ['P2-A2', A2]]) {
    const pOld = await boot(flags, { base: OLD }), pNew = await boot(flags);
    const tOld = await pOld.evaluate(() => window.__allTex()), tNew = await pNew.evaluate(() => window.__allTex());
    const dk = [...new Set([...Object.keys(tOld), ...Object.keys(tNew)])].filter((k) => tOld[k] !== tNew[k]);
    check(`${label}: every texture byte-identical to the previous build`, dk.length === 0, dk.join(' '));
    await pOld.close(); await pNew.close();
  }
  // P2-A2's rendered output — the world AND the HUD — pixel for pixel, over a
  // staged sequence through every P2-A2 path: STANDARD with both rings, a real
  // OVERRIDE pickup, bursts to empty, STANDARD after
  const frames = async (base, flags) => {
    const p = await boot(flags, { base });
    const r = await p.evaluate(async () => {
      const gs = window.__gs, P = gs.player;
      window.__stage(760, 810); window.__seed(55); window.__draws = 0;
      gs.spawnEnemyAt('grunt', 1000, 810); gs.spawnEnemyAt('shooter', 980, 700);
      const hashes = [];
      const fnv = (d) => { let h = 0x811c9dc5; for (let i = 0; i < d.length; i += 3) h = Math.imul(h ^ d[i], 16777619) >>> 0; return h.toString(16); };
      for (let i = 0; i < 330; i++) {
        P.superCharge = i < 60 ? 99 : 0; P.shieldHp = i < 60 ? 50 : 0;
        if (i < 60 && i % 9 === 0) { P.fireCooldown = 0; P.ammo = 3; P.tryFire(0.1); }
        if (i === 70) gs.weaponPickups.push(new window.__WP(gs, P.x, P.y, 'rifle'));
        if (i > 80) P.tryFire(-0.3);
        window.__adv(1);
        if (i % 3 === 0) hashes.push(fnv(await window.__grab(0, 0, 720, 1280)));
      }
      return { hashes, draws: window.__draws, sec: P.secondary };
    });
    await p.close();
    return r;
  };
  const fo = await frames(OLD, A2), fn = await frames(NOW, A2), fs = await frames(NOW, `${A2}&muzzle=sharp`);
  const df = firstDiff(fo.hashes, fn.hashes), ds = firstDiff(fo.hashes, fs.hashes);
  check(`P2-A2's RENDERED output (world + HUD, full canvas) is pixel-identical to the previous build over STANDARD with both rings, an OVERRIDE pickup, bursts to empty and STANDARD after (${fo.hashes.length} frames)`, df < 0 && fo.draws === fn.draws && fo.sec === null, df < 0 ? '' : `first differing frame ${df}`);
  check('P2-A2 + an ignored `muzzle=sharp`: the same frames, pixel for pixel', ds < 0 && fs.draws === fo.draws, ds < 0 ? '' : `first differing frame ${ds}`);
  const fb = await frames(NOW, B);
  const same = fb.hashes.filter((h, i) => h === fo.hashes[i]).length;
  check(`CONTROL: the same pixel check FAILS for P2-A3 against the previous P2-A2 (${fo.hashes.length - same} of ${fo.hashes.length} frames differ) — it can see a change`, same < fo.hashes.length && fo.hashes.length - same >= 60 && fb.draws === fo.draws, `${same} identical frames`);
  for (const [label, q, oldFlags, newFlags] of [['SWARM TIDE, R1', Q_SWARM, '', ''], ['SWARM TIDE, P1', Q_SWARM, P1, P1], ['SWARM TIDE, P2-A', Q_SWARM, A, A], ['SWARM TIDE, P2-A2', Q_SWARM, A2, A2],
    ['SWARM TIDE, B vs the previous P2-A2', Q_SWARM, A2, B], ['CROSSFIRE, BS vs the previous P2-A2', Q_CROSS, A2, BS], ['SWARM TIDE, R1 + ignored fxPilot=p2a3', Q_SWARM, '', 'fxPilot=p2a3']]) {
    const a = await replay(oldFlags, q, { base: OLD }), b = await replay(newFlags, q);
    const d = firstDiff(a.hashes, b.hashes);
    check(`${label}: ${TICKS} ticks identical to the previous build`, d < 0, d < 0 ? `${a.draws} draws` : `first divergent tick ${d}`);
  }
} else if (!SELF && on(11)) console.log('\n== 11. skipped (no --old=URL)');

// ── 12. RESTART AND RELOAD KEEP THE MODE ──────────────────────────────────
if (!SELF && on(12)) {
  console.log('\n== 12. restart and reload keep the mode');
  const p = await boot(BS);
  const lk = await p.evaluate(() => {
    const g = window.game;
    const sample = () => {
      const gs = g.scene.getScene('Game'), hud = g.scene.getScene('HUD');
      return { x: !!gs._p2a?.p2a3, sharp: !!gs._p2a?.sharp, hudOwn: Object.prototype.hasOwnProperty.call(hud, 'refreshSecondary'), cells: gs.children.list.filter((o) => o.texture?.key?.startsWith?.('p2a3-cell')).length,
        hudObjs: hud.children.list.filter((o) => o.texture?.key?.startsWith?.('p2a3-')).length, post: gs.events.listenerCount('postupdate'), font: hud.secText.style.fontSize };
    };
    const wait = () => { const gs = g.scene.getScene('Game'); for (let i = 0; i < 600 && !(gs.roomSpec && gs.player?.active && gs._p2a); i++) window.__adv(1); window.__adv(60); };
    const out = [];
    let old = g.scene.getScene('Game')._p2a.p2a3;
    for (let k = 0; k < 2; k++) {
      const gs = g.scene.getScene('Game');
      gs.player.equipSecondary('rifle'); window.__adv(5);           // mid-OVERRIDE: the HUD restyled, the cell lit
      gs.scene.start('Game', { mode: 'endless', seed: 4242 }); wait();
      const s = sample(); s.oldDead = !old.cell; old = g.scene.getScene('Game')._p2a.p2a3; out.push(s);
    }
    g.scene.getScene('Game').scene.stop('HUD'); g.scene.getScene('Game').scene.start('Title'); window.__adv(10);
    const title = { hudOwn: Object.prototype.hasOwnProperty.call(g.scene.getScene('HUD'), 'refreshSecondary') };
    g.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 4242 }); wait();
    const t = sample(); t.oldDead = !old.cell; out.push(t);
    const gs = g.scene.getScene('Game'); gs.player.equipSecondary('rifle'); window.__adv(3);
    const again = { text: g.scene.getScene('HUD').secText.text, icon: g.scene.getScene('HUD').secIcon.texture.key };
    return { out, title, again };
  });
  check('2 restarts mid-OVERRIDE + quit-to-title: the old layer destroyed, one cell, the HUD text size restored, wrappers and listeners steady; none at the title; OVERRIDE restyles again after',
    lk.out.every((s) => s.x && s.sharp && s.hudOwn && s.cells === 1 && s.oldDead && s.post === lk.out[0].post && s.font === '15px' && s.hudObjs <= 2) && !lk.title.hudOwn && lk.again.text === '27' && lk.again.icon === 'p2a3-hud-burst', JSON.stringify(lk));
  for (const [M, flags, want, sharp] of [['B', B, true, true], ['BC', BC, true, false], ['P2-A2', A2, false, false]]) {
    const q = await boot(flags);
    await q.reload();
    await q.waitForFunction(() => window.game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 60000 });
    const rl = await q.evaluate(async () => {
      const u = performance.getEntriesByType('resource').map((r) => r.name).find((n) => /systems\/debug\.js/.test(n));
      const d = await import(u);
      return { a3: d.isFxP2A3(), sharp: d.isMuzzleSharp(), tex: window.game.textures.exists('p2a3-cell-3') };
    });
    check(`${M}: a reload keeps the mode (and paints the p2a3 set only when on)`, rl.a3 === want && rl.sharp === sharp && rl.tex === want, JSON.stringify(rl));
    await q.close();
  }
  await p.close();
}

await browser.close();
const fails = results.filter((r) => !r.ok);
console.log(`\n${results.length - fails.length}/${results.length} passed${SELF ? '  (SELFTEST: sections 3, 5, 7 and 8 are expected to FAIL)' : ''}`);
if (SELF) {
  const must = ['no event added or removed', 'the cell rides the rifle exactly', 'headless ticks, B identical to P2-A2', 'draws no Math.random'];
  const ok = must.every((m) => fails.some((f) => f.name.includes(m)));
  console.log(ok ? 'SELFTEST OK: the checks caught the injected changes' : 'SELFTEST FAILED: a check did not catch an injected change');
  process.exit(ok ? 0 : 1);
}
process.exit(fails.length ? 1 : 0);
