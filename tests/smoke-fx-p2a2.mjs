// SMOKE: P2-A2 — PRIMARY CARBINE & OVERRIDE (`?visualPilot=v2c&polish=p1&fxPilot=p2a2`)
// — A LOADOUT PRESENTATION OVER UNCHANGED COMBAT, PROVEN AGAINST P2-A AND P1.
// Standalone; needs `npm run dev` on :5173 and, for section 11, the PREVIOUS
// build — `514a385`, the P2-A build — on another port (`--old=URL`).
//
// A  = `visualPilot=v2c&polish=p1&fxPilot=p2a`  (P2-A, the parent candidate)
// P1 = `visualPilot=v2c&polish=p1`               (approved, frozen)
// B  = `visualPilot=v2c&polish=p1&fxPilot=p2a2`
// Nothing here says P2-A2 feels better (the handset's job). It proves:
//   0  THE FLAG: `fxPilot=p2a2` honoured only with P1 live; it keeps the P2-A
//      layer; every other combination is that mode exactly
//   1  TEXTURES: B paints every P2-A texture byte-identically plus exactly the
//      five `p2a2-*`; an ignored flag adds nothing
//   2  INSTALL: B = P2-A's listeners and thirteen wrappers, plus one HUD
//      instance wrapper (`refreshSecondary`); P1's weapon Image hidden and the
//      carried rifle installed; P2-A has none of it
//   3  STANDARD: the ordinary shot is P2-A's / P1's shot — at 8 bearings every
//      bolt's position, bearing, velocity, scale, texture, body, damage, range;
//      over 360 ticks of held fire the shots fired, the ammo pool and its
//      refill, the cooldown and the recoil are A's tick for tick; B draws each
//      as STANDARD (rifle tracer, the single keylined discharge), the hero
//      holds p1-rifle throughout
//   4  OVERRIDE: the rifle pickup sits where A's does, is collected on A's tick,
//      equips 'rifle' with 27 rounds, fires three bolts a burst on A's ticks,
//      spends one round a bolt and empties back to no secondary on A's tick;
//      B draws OVERRIDE (alternating discharge shapes, heat primed on engage),
//      the module pickup, the OVERRIDE HUD readout, and the same rifle model on
//      every tick, before, during and after
//   5  TRANSITIONS: cluster pickup and back, death and revive, Super-ready +
//      shield while firing, restarts and quit-to-title
//   6  THE MUZZLE: 8 aims x 5 states (none, shield, Super ready, both,
//      charging): in front of the body the ignition core is drawn over the
//      shield bubble, behind it under the body; and in every case the core
//      leaves VISIBLE INK (rendered with vs without it, in the muzzle's
//      neighbourhood) — with P2-A's pistol flash measured the same way
//   7  SAME FIGHT: seeded replays, with a REAL rifle pickup collected mid-fight
//      and a cluster pod later: B vs P2-A and B vs P1 (SWARM TIDE production
//      and legacy, CROSSFIRE, BOMBER RUN; rendered; LOW quality)
//   8  READER ONLY: no Math.random in the frame; no gameplay write
//   9  BUDGET + LOW QUALITY
//  10  FROZEN FILES: no change against `514a385` outside debug.js, p2aFx.js,
//      p2aPaint.js and the new p2a2Loadout.js
//  11  AGAINST THE PREVIOUS BUILD (`--old`): R1, V2C, P1 and P2-A textures and
//      fights are that build's; P2-A's RENDERED frames are pixel-identical to
//      that build's over a staged sequence; B's fight is that build's P2-A fight
//  12  restart and reload keep the mode
// `--selftest` injects, in B only, a Math.random draw in the loadout frame, a
// 1px shift of the ordinary bolt, and a write of `player.secondary` from the
// loadout: sections 3, 4 and 7 must FAIL.
//
// usage: node tests/smoke-fx-p2a2.mjs [--old=URL] [--selftest] [--ticks=N] [--only=0,3]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { execSync } from 'node:child_process';
import { CHROME, bootPage, FIGHT_SEG } from './diag-stuck-audit.mjs';
import { enemyJsGuard } from './enemy-frozen.mjs';

const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const SELF = process.argv.includes('--selftest');
const OLD = opt('old', null);
const NOW = 'http://localhost:5173/';
const TICKS = +opt('ticks', '1500');
const BASE_REV = '514a385';
const P1 = 'visualPilot=v2c&polish=p1', A = `${P1}&fxPilot=p2a`, B = `${P1}&fxPilot=p2a2`;
const Q_SWARM = 'encdbg=swarmTide&room=hangar&sector=3';
const Q_CROSS = 'encdbg=crossfire&room=hangar&sector=6';
const Q_BOMB = 'encdbg=bomberRun&room=hangar&sector=4';
const P2A2_KEYS = ['p2a2-hud-override', 'p2a2-mz-o0', 'p2a2-mz-o1', 'p2a2-mz-s', 'p2a2-pickup-override'];
const ONLY = opt('only', '') ? new Set(opt('only', '').split(',').map(Number)) : null;
const on = (n) => !ONLY || ONLY.has(n);

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`); };
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const isB = (flags) => /fxPilot=p2a2/.test(flags) && /polish=p1/.test(flags) && /visualPilot=v2c/.test(flags);

async function instrument(p, flags) {
  await p.evaluate(async ({ self, b }) => {
    const gs = window.__gs;
    const fnv = (str) => { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0; return h; };
    window.__dbg = await window.__mod(/systems\/debug\.js/);
    window.__fxmod = await window.__mod(/systems\/FX\.js/);
    window.__WP = (await window.__mod(/entities\/WeaponPickup\.js/))?.WeaponPickup;
    if (self && b) {
      const L = gs._p2a.loadout;
      const u = L.update.bind(L); L.update = () => { Math.random(); u(); };
      const fp = gs.firePlayerPrimary.bind(gs);
      gs.firePlayerPrimary = (a) => { const x = gs.player.x; gs.player.x += 1; fp(a); gs.player.x = x; };
      const u2 = L.update; L.update = () => { u2(); if (gs.player.secondary === 'rifle' && gs.player.secondaryAmmo < 20) gs.player.secondary = null; };
    }
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
    window.__carried = () => {
      const L = gs._p2a?.loadout, w = L ? L.view : gs._p1Player?.weapon;
      return w ? `${w.texture.key}${w.visible ? '' : '(hidden)'}` : 'none';
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
      let carriedBad = 0;
      const f = (v) => (Math.round(v * 1000) / 1000).toString();
      for (let i = 0; i < ticks; i++) {
        const cur = seg.find(([a, bb]) => i >= a && i < bb)[2];
        K.A.isDown = cur.includes('A'); K.D.isDown = cur.includes('D'); K.W.isDown = cur.includes('W'); K.S.isDown = cur.includes('S');
        if (i >= 60 && i % 7 === 0) P.keyboardFire();
        if (superAt.includes(i)) { P.superCharge = 999; P.tryFireSuper(P._autoAimAngle()); }
        if (superAt.map((s) => s - 120).includes(i)) P.superCharge = 999;
        if (melee.includes(i)) { P.meleeCharge = 99; P.tryMeleeCombo(); }
        // REAL pickups, dropped on the hero: the rifle (OVERRIDE) and later a cluster pod
        if (i === pickAt) gs.weaponPickups.push(new window.__WP(gs, P.x, P.y, 'rifle'));
        if (i === clusterAt) gs.weaponPickups.push(new window.__WP(gs, P.x, P.y, 'cluster'));
        window.__adv(1);
        if (gs._p2a?.loadout && !/^p1-(rifle|blade)/.test(gs._p2a.loadout.view.texture.key)) carriedBad++;
        let s = `${i}|${f(P.x)},${f(P.y)},${P.hp},${f(P.body.center.x)},${f(P.body.center.y)},${P.superCharge},${P.meleeCharge},${P.ammo},${P.secondary},${P.secondaryAmmo},${P.fireCooldown}|${f(cam.scrollX)},${f(cam.scrollY)},${f(cam.zoom)}|${f(gs.time.timeScale)}|`;
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
      const st = gs._p2a?.stats;
      return { hashes, draws: window.__draws, carriedBad, stats: st ? JSON.parse(JSON.stringify(st)) : null, lstats: gs._p2a?.loadout?.stats ? { ...gs._p2a.loadout.stats } : null };
    };
  }, { self: SELF, b: isB(flags) });
}
async function boot(flags, { base = NOW, q = 'room=hangar', seed = 4242, viewport } = {}) {
  const p = await bootPage(browser, { base, flags, baseline: null, q, seed, viewport });
  await instrument(p, flags);
  return p;
}
const firstDiff = (a, b) => { const n = Math.max(a.length, b.length); for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i; return -1; };

// ── 0. THE FLAG ───────────────────────────────────────────────────────────
if (on(0)) {
  console.log('\n== 0. the flag');
  const cases = [['', false, false, false], ['fxPilot=p2a2', false, false, false], ['visualPilot=v2c&fxPilot=p2a2', false, false, false],
    ['visualPilot=v2&polish=p1&fxPilot=p2a2', false, false, false], ['visualPilot=v2b&polish=p1&fxPilot=p2a2', false, false, false],
    [P1, false, false, true], [A, false, true, true], [B, true, true, true], [`${P1}&fxPilot=P2A2`, false, false, true], [`${P1}&fxPilot=p2a3`, false, false, true],
    [`baseline=legacy&${B}`, true, true, true]];
  const sw = {};
  for (const [flags, want2, wantA, p1] of cases) {
    const p = await boot(flags);
    const r = await p.evaluate(() => {
      const d = window.__dbg, gs = window.__gs;
      return { a2: d.isFxP2A2(), a: d.isFxP2A(), p1: d.isPolishP1(), layer: !!gs._p2a, loadout: !!gs._p2a?.loadout, base: d.getGameplayBaseline(),
        sw: [d.isRosterV1(), d.isMoveV22(), d.isGaitV2(), d.getBulwarkStuck(), d.getMarksmanStuck(), d.isMarksmanAngle(), d.isBulwarkAngle()].join(',') };
    });
    check(`?${flags || '(no flags)'} -> P2-A2 ${want2 ? 'ON' : 'off'}, P2-A layer ${wantA ? 'on' : 'off'}, P1 ${p1 ? 'on' : 'off'}`,
      r.a2 === want2 && r.a === wantA && r.layer === wantA && r.loadout === want2 && r.p1 === p1, JSON.stringify(r));
    (sw[r.base] ||= new Set()).add(r.sw);
    await p.close();
  }
  check('the flag moves none of the seven gameplay switches (per baseline)', Object.values(sw).every((s) => s.size === 1), JSON.stringify(Object.fromEntries(Object.entries(sw).map(([k, v]) => [k, [...v]]))));
}

// ── 1. TEXTURES ───────────────────────────────────────────────────────────
if (on(1)) {
  console.log('\n== 1. textures');
  const tex = async (flags) => { const p = await boot(flags); const t = await p.evaluate(() => window.__allTex()); await p.close(); return t; };
  const tA = await tex(A), tB = await tex(B);
  const changed = Object.keys(tA).filter((k) => tA[k] !== tB[k]);
  const added = Object.keys(tB).filter((k) => !(k in tA)).sort();
  check(`B: every P2-A texture byte-identical (${Object.keys(tA).length}: P1, the p2a-* set, roster, pickups, \`bullet\`)`, changed.length === 0, changed.join(' '));
  check(`B: the added textures are exactly the ${P2A2_KEYS.length} p2a2-* keys`, JSON.stringify(added) === JSON.stringify(P2A2_KEYS), added.join(' '));
  for (const [label, base, ign] of [['R1', '', 'fxPilot=p2a2'], ['V2C', 'visualPilot=v2c', 'visualPilot=v2c&fxPilot=p2a2'], ['P1 + p2a3', P1, `${P1}&fxPilot=p2a3`]]) {
    const t0 = await tex(base), t1 = await tex(ign);
    const keys = [...new Set([...Object.keys(t0), ...Object.keys(t1)])];
    const d = keys.filter((k) => t0[k] !== t1[k]);
    check(`${label} + ignored fxPilot: every texture byte-identical, no p2a2 key`, d.length === 0 && !Object.keys(t1).some((k) => k.startsWith('p2a2-')), d.join(' '));
  }
}

// ── 2. INSTALL ────────────────────────────────────────────────────────────
const installState = (p) => p.evaluate(() => {
  const gs = window.__gs, ev = gs.events, hud = window.game.scene.getScene('HUD');
  const out = {};
  for (const n of ev.eventNames()) out[String(n)] = ev.listenerCount(n);
  return { game: out, wraps: gs._p2a?._wrapped?.length ?? 0, hudOwn: Object.prototype.hasOwnProperty.call(hud, 'refreshSecondary'),
    p1vis: gs._p1Player.weapon.visible, view: gs._p2a?.loadout?.view?.texture?.key || null, inList: gs._p2a?.loadout ? gs.children.list.includes(gs._p2a.loadout.view) : false };
});
if (on(2)) {
  console.log('\n== 2. install');
  const pA = await boot(A), pB = await boot(B);
  const lA = await installState(pA), lB = await installState(pB);
  const ev = [...new Set([...Object.keys(lA.game), ...Object.keys(lB.game)])];
  const diff = ev.filter((k) => (lA.game[k] || 0) !== (lB.game[k] || 0));
  check('B adds no game-event listener to P2-A\'s (the loadout polls in P2-A\'s own frame)', diff.length === 0, diff.join(' '));
  check('B keeps P2-A\'s thirteen wrappers and adds exactly one HUD instance wrapper (refreshSecondary); P2-A has no HUD wrapper', lB.wraps === 13 && lA.wraps === 13 && lB.hudOwn && !lA.hudOwn, JSON.stringify({ a: lA.wraps, b: lB.wraps, hudA: lA.hudOwn, hudB: lB.hudOwn }));
  check('B: P1\'s weapon Image hidden, the carried rifle (p1-rifle) in the display list; P2-A: P1\'s weapon shown, no carried rifle', !lB.p1vis && lB.view === 'p1-rifle' && lB.inList && lA.p1vis && lA.view === null, JSON.stringify({ a: [lA.p1vis, lA.view], b: [lB.p1vis, lB.view, lB.inList] }));
  await pA.close(); await pB.close();
}

// ── 3. STANDARD ───────────────────────────────────────────────────────────
if (on(3)) {
  console.log('\n== 3. STANDARD (the ordinary shot, drawn as the carbine)');
  const BEAR = [0, 0.7, 1.6, 2.5, 3.1, -0.4, -1.57, -2.4];
  const run = async (flags) => {
    const p = await boot(flags);
    const r = await p.evaluate((bear) => {
      const gs = window.__gs, P = gs.player, c = gs._p2a;
      window.__stage(800, 780); window.__seed(77); window.__draws = 0;
      const f = (v) => v.toFixed(3);
      const grab = () => gs.playerBullets.getChildren().filter((b) => b.active).map((b) => [f(b.x), f(b.y), b.rotation.toFixed(4), f(b.body.velocity.x), f(b.body.velocity.y), b.scaleX.toFixed(4),
        b.texture.key, b.body.radius, f(b.body.offset.x), f(b.body.offset.y), b.damage, b.range, b.knockback, b.owner].join(',')).sort().join(' ');
      const volleys = [], styles = [], carried = new Set();
      for (const a of bear) {
        P.fireCooldown = 0; P.ammo = 99; P.tryFire(a); window.__adv(1);
        volleys.push(`${a}:${grab()}`);
        if (c) {
          const r0 = c.bolts.find((q) => !q.dead && q.b.active);
          const f0 = c.flashes[c.flashes.length - 1];
          styles.push(`${r0?.kind}/${r0?.tail.texture.key}/${r0?.head.texture.key}/${f0?.img.texture.key}`);
        }
        carried.add(window.__carried());
        window.__adv(40);
      }
      // held fire: shots, ammo pool + refill, cooldown, recoil, tick for tick
      window.__stage(800, 780); window.__seed(78); window.__draws = 0;
      // start from the real pool (PLAYER.ammoMax: one HUD pip each) so the refill is exercised
      P.ammo = window.game.scene.getScene('HUD').ammoPips.length; P.ammoTimers = [];
      const timeline = [];
      let shots = 0;
      const onFire = () => shots++;
      gs.events.on('player-fire', onFire);
      for (let i = 0; i < 360; i++) {
        P.tryFire(0.3);
        window.__adv(1);
        timeline.push(`${i}:${shots},${P.ammo},${P.ammoTimers.length},${P.fireCooldown.toFixed(2)},${f(P.body.velocity.x)},${f(P.body.velocity.y)},${P._wKickT},${P.recoilT}`);
        carried.add(window.__carried());
      }
      gs.events.off('player-fire', onFire);
      return { volleys, styles, carried: [...carried], timeline, shots, draws: window.__draws };
    }, BEAR);
    await p.close();
    return r;
  };
  const rA = await run(A), rB = await run(B), rP = await run(P1);
  const dv = rA.volleys.findIndex((x, i) => x !== rB.volleys[i]);
  const dv1 = rP.volleys.findIndex((x, i) => x !== rB.volleys[i]);
  check(`one ordinary shot is one bolt with P2-A's and P1's position, bearing, velocity, stretch, texture, body (30), damage, range, knockback (8 bearings)`,
    dv < 0 && dv1 < 0 && rB.volleys.every((v) => v.split(':')[1].split(' ').length === 1 && v.includes(',bullet,30,')), dv < 0 ? '' : `first difference ${rA.volleys[dv]?.slice(0, 80)} / ${rB.volleys[dv]?.slice(0, 80)}`);
  const dt = firstDiff(rA.timeline, rB.timeline), dt1 = firstDiff(rP.timeline, rB.timeline);
  check(`360 ticks of held fire: shots (${rB.shots}), ammo pool + refill timers, cooldown, recoil velocity and kick timers = P2-A's and P1's at every tick, with their draw counts`,
    dt < 0 && dt1 < 0 && rA.draws === rB.draws && rP.draws === rB.draws && rB.shots > 10, dt < 0 ? `draws ${rB.draws}` : `tick ${dt}: A ${rA.timeline[dt]} / B ${rB.timeline[dt]}`);
  check('B draws every ordinary shot as STANDARD: the rifle tracer (p2a-tail-r / p2a-head-r) and the single keylined discharge (p2a2-mz-s)', rB.styles.length === 8 && rB.styles.every((s) => s === 'standard/p2a-tail-r/p2a-head-r/p2a2-mz-s'), rB.styles[0]);
  check('P2-A draws the same shot as its pistol (p2a-tail-p / p2a-mz-p) — its comparison output is kept', rA.styles.every((s) => s === 'pistol/p2a-tail-p/p2a-head-p/p2a-mz-p'), rA.styles[0]);
  check('B: the hero holds the P1 rifle on every sampled tick of STANDARD fire (P2-A: the P1 pistol)', rB.carried.every((k) => /^p1-rifle/.test(k)) && rA.carried.every((k) => /^p1-pistol/.test(k)), `${rB.carried} / ${rA.carried}`);
}

// ── 4. OVERRIDE ───────────────────────────────────────────────────────────
if (on(4)) {
  console.log('\n== 4. OVERRIDE (the rifle pickup)');
  const run = async (flags) => {
    const p = await boot(flags);
    const r = await p.evaluate(() => {
      const gs = window.__gs, P = gs.player, c = gs._p2a, hud = window.game.scene.getScene('HUD');
      // the reward pair, as the game drops it (rifle at x - 150): the hero below the rifle
      window.__stage(610, 820); window.__seed(91); window.__draws = 0;
      gs.spawnWeaponChoice(760, 640, 'REWARD'); window.__adv(2);
      const pk = gs.weaponPickups.find((q) => q.weaponId === 'rifle');
      const pick = { x: pk.x.toFixed(2), y: pk.y.toFixed(2), tex: pk.sprite.texture.key, label: pk.label.text };
      // walk onto it
      const K = gs.keys; K.W.isDown = true;
      let tookAt = -1;
      for (let i = 0; i < 200 && tookAt < 0; i++) { window.__adv(1); if (P.secondary === 'rifle') tookAt = i; }
      K.W.isDown = false;
      const after = { sec: P.secondary, ammo: P.secondaryAmmo, hud: hud.secText.text, icon: hud.secIcon.texture.key, iconScale: hud.secIcon.scaleX, heat: c ? +c.heat.toFixed(2) : null };
      // fire bursts until it runs dry
      const shotTicks = [], ammoTrail = [], carried = new Set(), shapes = [];
      let fired = 0; const onRifle = () => { fired++; shotTicks.push(window.__tick); if (c) { const f0 = c.flashes[c.flashes.length - 1]; } };
      window.__tick = 0;
      gs.events.on('player-fire-rifle', onRifle);
      let emptyAt = -1;
      for (let i = 0; i < 600 && emptyAt < 0; i++) {
        window.__tick = i;
        P.tryFire(-0.2);
        window.__adv(1);
        ammoTrail.push(`${P.secondary}:${P.secondaryAmmo}`);
        carried.add(window.__carried());
        if (c) for (const f of c.flashes) if (f.age === 0 || f.age < 17) shapes.push(f.img.texture.key);
        if (P.secondary !== 'rifle') emptyAt = i;
      }
      gs.events.off('player-fire-rifle', onRifle);
      for (let i = 0; i < 30; i++) { P.tryFire(-0.2); window.__adv(1); carried.add(window.__carried()); }
      const end = { sec: P.secondary, ammo: P.secondaryAmmo, hudIcon: hud.secIcon.visible, hudText: hud.secText.text };
      const styles = c ? { ...c.stats.styles } : null;
      return { pick, tookAt, after, shotTicks, fired, ammoTrail, emptyAt, end, carried: [...carried], styles, shapes: [...new Set(shapes)], draws: window.__draws, lstats: c?.loadout ? { ...c.loadout.stats } : null };
    });
    await p.close();
    return r;
  };
  const rA = await run(A), rB = await run(B);
  check('the rifle pickup sits where P2-A\'s does and is collected on P2-A\'s tick', rA.pick.x === rB.pick.x && rA.pick.y === rB.pick.y && rA.tookAt === rB.tookAt && rB.tookAt >= 0, JSON.stringify({ a: [rA.pick.x, rA.pick.y, rA.tookAt], b: [rB.pick.x, rB.pick.y, rB.tookAt] }));
  check('it equips the shipped rifle secondary: `rifle`, 27 rounds (A and B)', rA.after.sec === 'rifle' && rB.after.sec === 'rifle' && rA.after.ammo === 27 && rB.after.ammo === 27);
  check(`bursts: ${rB.fired} bolts fired on P2-A's ticks (three a burst), one round each, emptying on P2-A's tick back to no secondary, with P2-A's draw count`,
    JSON.stringify(rA.shotTicks) === JSON.stringify(rB.shotTicks) && rB.fired === 27 && JSON.stringify(rA.ammoTrail) === JSON.stringify(rB.ammoTrail) && rA.emptyAt === rB.emptyAt && rB.end.sec === null && rA.draws === rB.draws,
    `fired A ${rA.fired} B ${rB.fired}; emptied A ${rA.emptyAt} B ${rB.emptyAt}; draws ${rA.draws}/${rB.draws}`);
  const gaps = rB.shotTicks.slice(1).map((t, i) => t - rB.shotTicks[i]);
  check('the burst keeps its shipped rhythm (75ms: 5 ticks between bolts in a burst, the 300ms cooldown — 9 ticks — before the next)', gaps.filter((g) => g <= 5).length >= 18 && gaps.filter((g) => g >= 8).length >= 8, gaps.slice(0, 9).join(','));
  check('B draws the module pickup (p2a2-pickup-override) labelled OVERRIDE / 3-SHOT BURST; P2-A the shipped rifle pickup', rB.pick.tex === 'p2a2-pickup-override' && rB.pick.label === 'OVERRIDE\n3-SHOT BURST' && rA.pick.tex === 'pickup-rifle', JSON.stringify([rA.pick.tex, rB.pick.tex, rB.pick.label]));
  check('B: the HUD reads OVERRIDE with its round count and the 3-SHOT BURST module; P2-A: DC-15', /^OVERRIDE {2}27$/.test(rB.after.hud) && rB.after.icon === 'p2a2-hud-override' && /^DC-15/.test(rA.after.hud), JSON.stringify([rA.after.hud, rB.after.hud, rB.after.icon]));
  check('B: OVERRIDE engaged primes the barrel (heat 3 on collection, one frame of its 90ms half-life later >= 2.5)', rB.after.heat >= 2.5 && rB.lstats.primes >= 1, JSON.stringify({ heat: rB.after.heat, primes: rB.lstats?.primes }));
  check('B draws the bursts as OVERRIDE with both discharge shapes; the ordinary shots after it as STANDARD', rB.styles.override === 27 && rB.shapes.includes('p2a2-mz-o0') && rB.shapes.includes('p2a2-mz-o1') && (rB.styles.standard || 0) > 0, JSON.stringify({ styles: rB.styles, shapes: rB.shapes }));
  check('B: the same rifle model on every tick — OVERRIDE, then STANDARD after it ran dry (P2-A switches rifle -> pistol)', rB.carried.every((k) => /^p1-rifle/.test(k)) && rA.carried.some((k) => /^p1-rifle/.test(k)) && rA.carried.some((k) => /^p1-pistol/.test(k)), `${rB.carried} / ${rA.carried}`);
  check('emptied: no secondary, the HUD readout cleared (A and B)', rA.end.sec === null && rB.end.sec === null && !rB.end.hudIcon && rB.end.hudText === '' && !rA.end.hudIcon, JSON.stringify([rA.end, rB.end]));
}

// ── 5. TRANSITIONS ────────────────────────────────────────────────────────
if (on(5)) {
  console.log('\n== 5. transitions');
  const run = async (flags) => {
    const p = await boot(flags);
    const r = await p.evaluate(() => {
      const gs = window.__gs, P = gs.player, hud = window.game.scene.getScene('HUD');
      window.__stage(760, 820); window.__seed(12); window.__draws = 0;
      const out = {};
      out.spawn = { sec: P.secondary, carried: window.__carried() };
      // OVERRIDE, part used, then a cluster pod replaces it
      P.equipSecondary('rifle'); window.__adv(1);
      for (let i = 0; i < 40; i++) { P.tryFire(0); window.__adv(1); }
      out.partial = { sec: P.secondary, ammo: P.secondaryAmmo, carried: window.__carried(), hud: hud.secText.text };
      gs.weaponPickups.push(new window.__WP(gs, P.x, P.y, 'cluster')); window.__adv(3);
      out.cluster = { sec: P.secondary, ammo: P.secondaryAmmo, carried: window.__carried(), hud: hud.secText.text, icon: hud.secIcon.texture.key, iconScale: +hud.secIcon.scaleX.toFixed(2) };
      for (let i = 0; i < 3; i++) { P.fireCooldown = 0; P.tryFire(0); window.__adv(30); }
      window.__adv(120);
      out.clusterSpent = { sec: P.secondary, carried: window.__carried(), hudIcon: hud.secIcon.visible };
      for (let i = 0; i < 10; i++) { P.fireCooldown = 0; P.tryFire(0); window.__adv(1); }
      out.backToStandard = { sec: P.secondary, carried: window.__carried(), shots: gs.playerBullets.getChildren().filter((b) => b.active).length };
      // Super ready + shield while firing
      P.superCharge = 99; P.shieldHp = 50; window.__adv(2);
      P.fireCooldown = 0; P.tryFire(0.5); window.__adv(1);
      out.ringsFire = { ring: gs._p1Player.ring.visible, shield: P.shieldRing.visible, carried: window.__carried(), bolt: gs.playerBullets.getChildren().filter((b) => b.active).length };
      P.superCharge = 0; P.shieldHp = 0;
      // death and revive
      P.die(); window.__adv(3);
      const L = gs._p2a?.loadout, vw = L ? L.view : gs._p1Player.weapon;
      out.dead = { alpha: vw.alpha };
      P.alive = true; P.hp = P.hpMax; window.__adv(3);
      out.revived = { alpha: vw.alpha, carried: window.__carried() };
      return { out, draws: window.__draws };
    });
    await p.close();
    return r;
  };
  const rA = await run(A), rB = await run(B);
  const o = rB.out, a = rA.out;
  const mech = (x) => JSON.stringify([x.spawn.sec, x.partial.sec, x.partial.ammo, x.cluster.sec, x.cluster.ammo, x.clusterSpent.sec, x.backToStandard.sec, x.backToStandard.shots, x.ringsFire.bolt]);
  check('the mechanical sequence (spawn -> OVERRIDE -> part used -> cluster pod -> spent -> ordinary fire; Super-ready + shield fire) is P2-A\'s, with its draws', mech(o) === mech(a) && rA.draws === rB.draws, `${mech(a)} / ${mech(o)}`);
  check('B carries the rifle at spawn, in OVERRIDE, with the cluster pod, after it, with both rings up', [o.spawn, o.partial, o.cluster, o.clusterSpent, o.backToStandard, o.ringsFire].every((s) => /^p1-rifle/.test(s.carried)), [o.spawn, o.partial, o.cluster, o.backToStandard].map((s) => s.carried).join(' '));
  check('B: with the cluster pod the HUD is the shipped cluster panel (icon, 0.42 scale, CLUSTER)', o.cluster.icon === 'pickup-cluster' && o.cluster.iconScale === 0.42 && /^CLUSTER/.test(o.cluster.hud), JSON.stringify(o.cluster));
  check('Super ready and the shield both up while firing: the ring and the bubble are drawn and the shot leaves', o.ringsFire.ring && o.ringsFire.shield && o.ringsFire.bolt >= 1, JSON.stringify(o.ringsFire));
  check('death hides the carried rifle (alpha 0) and the revive shows it again (A\'s rule)', o.dead.alpha === 0 && o.revived.alpha === 1 && a.dead.alpha === 0 && /^p1-rifle/.test(o.revived.carried), JSON.stringify([o.dead, o.revived]));
  // restarts and quit-to-title
  const p = await boot(B);
  const lk = await p.evaluate(() => {
    const g = window.game;
    const sample = () => {
      const gs = g.scene.getScene('Game'), hud = g.scene.getScene('HUD');
      return { inst: !!gs._p2a?.loadout, hudOwn: Object.prototype.hasOwnProperty.call(hud, 'refreshSecondary'), p1vis: gs._p1Player?.weapon?.visible, views: gs.children.list.filter((o) => o.texture?.key?.startsWith?.('p1-rifle')).length, post: gs.events.listenerCount('postupdate') };
    };
    const wait = () => { const gs = g.scene.getScene('Game'); for (let i = 0; i < 600 && !(gs.roomSpec && gs.player?.active && gs._p2a); i++) window.__adv(1); window.__adv(60); };
    const out = [];
    let old = g.scene.getScene('Game')._p2a.loadout;
    for (let k = 0; k < 2; k++) {
      const gs = g.scene.getScene('Game');
      gs.player.equipSecondary('rifle'); window.__adv(5);
      gs.scene.start('Game', { mode: 'endless', seed: 4242 }); wait();
      const s = sample(); s.oldDead = !old.view; old = g.scene.getScene('Game')._p2a.loadout; out.push(s);
    }
    g.scene.getScene('Game').scene.stop('HUD'); g.scene.getScene('Game').scene.start('Title'); window.__adv(10);
    const title = { hudOwn: Object.prototype.hasOwnProperty.call(g.scene.getScene('HUD'), 'refreshSecondary') };
    g.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 4242 }); wait();
    const t = sample(); t.oldDead = !old.view; out.push(t);
    return { out, title };
  });
  check('2 restarts + quit-to-title: the old loadout destroyed, exactly one fresh carried rifle and one HUD wrapper, P1\'s weapon hidden, listener counts steady; none at the title',
    lk.out.every((s) => s.inst && s.hudOwn && s.p1vis === false && s.views === 1 && s.oldDead && s.post === lk.out[0].post) && !lk.title.hudOwn, JSON.stringify(lk));
  await p.close();
}

// ── 6. THE MUZZLE ─────────────────────────────────────────────────────────
if (on(6)) {
  console.log('\n== 6. the muzzle: depth and visible ink');
  const AIMS = [['E', 0], ['SE', 0.785], ['S', 1.571], ['SW', 2.356], ['W', 3.1416], ['NW', -2.356], ['N', -1.571], ['NE', -0.785]];
  const STATES = { none: {}, shield: { shield: 1 }, ready: { ready: 1 }, both: { shield: 1, ready: 1 }, charging: { charge: 2 } };
  const run = async (flags) => {
    const p = await boot(flags);
    const r = await p.evaluate(async ({ aims, states }) => {
      const gs = window.__gs, P = gs.player, c = gs._p2a;
      window.__stage(760, 820);
      const out = [];
      for (const [sn, o] of Object.entries(states)) for (const [an, a] of aims) {
        P.x = 760; P.y = 820; P.body.reset(760, 820); P.fireCooldown = 0; P.ammo = 99;
        const set = () => { P.shieldHp = o.shield ? 50 : 0; P.superCharge = o.ready ? 99 : (o.charge || 0); };
        set(); window.__adv(24); set();
        P.tryFire(a); window.__adv(1);
        const f = c.flashes[c.flashes.length - 1];
        if (!f) { out.push({ sn, an, none: true }); continue; }
        const L = c._weapon(), front = L.depth >= P.depth;
        const cam = gs.cameras.main, wv = cam.worldView;
        const sx = (f.img.x - wv.x) * cam.zoom + cam.x, sy = (f.img.y - wv.y) * cam.zoom + cam.y;
        const R = 44, x0 = Math.round(sx - R), y0 = Math.round(sy - R);
        const withF = await window.__grab(x0, y0, 2 * R, 2 * R);
        const vis = [f.img.visible, f.glow?.visible];
        f.img.setVisible(false); f.glow?.setVisible(false);
        const without = await window.__grab(x0, y0, 2 * R, 2 * R);
        f.img.setVisible(vis[0]); if (f.glow) f.glow.setVisible(vis[1]);
        let ink = 0;
        for (let i = 0; i < withF.length; i += 4) if (Math.abs(withF[i] - without[i]) + Math.abs(withF[i + 1] - without[i + 1]) + Math.abs(withF[i + 2] - without[i + 2]) > 60) ink++;
        out.push({ sn, an, front, core: f.img.depth, shield: P.shieldRing.depth, shieldOn: P.shieldRing.visible, body: P.depth, ring: gs._p1Player.ring.depth, ink, tex: f.img.texture.key });
        window.__adv(40);
      }
      return out;
    }, { aims: AIMS, states: STATES });
    await p.close();
    return r;
  };
  const rB = await run(B), rA = await run(A);
  const bad = rB.filter((x) => x.none || (x.front ? !(x.core > x.shield) : !(x.core < x.body)));
  check(`B, 8 aims x 5 states: in front of the body the ignition core is over the shield bubble (and the hero, and the ring); behind the body it is under the body`, bad.length === 0 && rB.length === 40,
    bad.slice(0, 3).map((x) => `${x.sn}/${x.an} front=${x.front} core ${x.core} shield ${x.shield} body ${x.body}`).join('; '));
  const minInk = Math.min(...rB.map((x) => x.ink));
  check(`B: the ignition leaves visible ink in every one of the 40 cases (min ${minInk} px changed in an 88px box, at the firing tick)`, minInk >= 150, rB.filter((x) => x.ink < 150).map((x) => `${x.sn}/${x.an}:${x.ink}`).join(' '));
  const byState = (r) => Object.fromEntries(Object.keys(STATES).map((s) => [s, Math.round(r.filter((x) => x.sn === s).reduce((t, x) => t + x.ink, 0) / 8)]));
  const iB = byState(rB), iA = byState(rA);
  check(`mean visible ink per state, P2-A pistol -> P2-A2 STANDARD: ${Object.keys(iB).map((s) => `${s} ${iA[s]} -> ${iB[s]}`).join(', ')}`, Object.keys(iB).every((s) => iB[s] > iA[s]));
  check('B: the core is drawn over the P1 ring in every case', rB.every((x) => x.core > x.ring));
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
    const a = await replay([base, A].filter(Boolean).join('&'), q);
    const b = await replay([base, B].filter(Boolean).join('&'), q);
    const d = firstDiff(a.hashes, b.hashes);
    const st = b.stats || {}, sty = st.styles || {};
    const ran = (sty.standard || 0) > 0 && (sty.override || 0) > 0 && b.lstats?.pickups >= 1;
    check(`${label}: ${TICKS} headless ticks, B identical to P2-A (state, pickups, ammo, draws; a real OVERRIDE pickup and a cluster pod collected)`, d < 0 && ran && b.carriedBad === 0,
      d < 0 ? `${a.draws} draws; B drew ${sty.standard} STANDARD + ${sty.override} OVERRIDE tracers, ${b.lstats?.pickups} module pickups; carried rifle on every tick` : `first divergent tick ${d}`);
  }
  {
    const p1 = await replay(P1, Q_SWARM), b = await replay(B, Q_SWARM);
    const d = firstDiff(p1.hashes, b.hashes);
    check(`SWARM TIDE, production: ${TICKS} ticks, B identical to P1`, d < 0, d < 0 ? `${p1.draws} draws` : `first divergent tick ${d}`);
  }
  const n = Math.min(TICKS, 600);
  const a = await replay(A, Q_SWARM, { headless: false, ticks: n }), b = await replay(B, Q_SWARM, { headless: false, ticks: n });
  const d = firstDiff(a.hashes, b.hashes);
  check(`SWARM TIDE, production: ${n} RENDERED ticks, B identical to P2-A`, d < 0 && (b.stats.styles.override || 0) > 0, d < 0 ? `${a.draws} draws` : `first divergent tick ${d}`);
  const al = await replay(A, Q_CROSS, { headless: false, ticks: n, low: true }), bl = await replay(B, Q_CROSS, { headless: false, ticks: n, low: true });
  const dl = firstDiff(al.hashes, bl.hashes);
  check(`CROSSFIRE in LOW quality: ${n} rendered ticks, B identical to P2-A`, dl < 0 && bl.stats.bolts > 0, dl < 0 ? `${al.draws} draws` : `first divergent tick ${dl}`);
  for (const [label, base, ign] of [['R1', '', 'fxPilot=p2a2'], ['V2C', 'visualPilot=v2c', 'visualPilot=v2c&fxPilot=p2a2']]) {
    const m = Math.min(TICKS, 800);
    const x = await replay(base, Q_SWARM, { ticks: m }), y = await replay(ign, Q_SWARM, { ticks: m });
    const dd = firstDiff(x.hashes, y.hashes);
    check(`${label} + ignored fxPilot=p2a2: ${m} ticks identical to ${label}`, dd < 0, dd < 0 ? '' : `first divergent tick ${dd}`);
  }
}

// ── 8. READER ONLY ────────────────────────────────────────────────────────
if (on(8)) {
  console.log('\n== 8. reader only');
  const p = await boot(B, { q: Q_SWARM });
  const r = await p.evaluate(() => {
    const gs = window.__gs, P = gs.player, c = gs._p2a, L = c.loadout;
    let inside = 0, wrote = 0;
    const u = c.update.bind(c);
    const snap = () => [P.secondary, P.secondaryAmmo, P.ammo, P.fireCooldown, P.x, P.y, P.facing, P.aim, P.superCharge, P.body.velocity.x, gs.time.timeScale].join();
    c.update = (t, d) => { const s0 = snap(), d0 = window.__draws; u(t, d); inside += window.__draws - d0; if (snap() !== s0) wrote++; };
    window.__seed(5); window.__draws = 0;
    for (let i = 0; i < 400; i++) {
      if (i % 5 === 0) P.keyboardFire();
      if (i === 150) gs.weaponPickups.push(new window.__WP(gs, P.x, P.y, 'rifle'));
      window.__adv(1);
    }
    return { inside, wrote, styles: c.stats.styles, pickups: L.stats.pickups };
  });
  await p.close();
  check(`the P2-A2 frame (loadout + P2-A) draws no Math.random over 400 ticks with an OVERRIDE pickup (${JSON.stringify(r.styles)})`, r.inside === 0 && (r.styles.override || 0) > 0, `${r.inside} draws`);
  check('the P2-A2 frame writes no player or clock field (secondary, ammo, cooldown, position, aim, Super, velocity, time scale)', r.wrote === 0, `${r.wrote} frames changed something`);
}

// ── 9. BUDGET + LOW QUALITY ───────────────────────────────────────────────
if (on(9)) {
  console.log('\n== 9. budget + low quality');
  const p = await boot(B, { q: Q_SWARM });
  const r = await p.evaluate(() => {
    const gs = window.__gs, P = gs.player, c = gs._p2a;
    window.__headless = true;
    const fire = (n) => { for (let i = 0; i < n; i++) { if (i % 4 === 0) { P.fireCooldown = 0; P.ammo = 99; P.keyboardFire(); } if (i % 200 === 0) P.equipSecondary('rifle'); window.__adv(1); } };
    const count = () => gs.children.list.filter((o) => o.texture?.key?.startsWith?.('p2a') || o === c.loadout.view || (o.type === 'Graphics' && c.gfxPool.includes(o))).length;
    fire(240); const o0 = count(); fire(600); const o1 = count();
    window.__headless = false;
    window.__fxmod.setLowQuality(true);
    window.__adv(60);                      // effects made before the switch run out first
    let glow = 0, sparks = 0, tracer = 0, flash = 0;
    for (let i = 0; i < 120; i++) { if (i % 6 === 0) { P.fireCooldown = 0; P.keyboardFire(); } window.__adv(1); for (const b of c.bolts) { if (b.glow) glow++; if (b.tail.visible) tracer++; } for (const f of c.flashes) { if (f.glow) glow++; if (f.img.visible) flash++; } for (const m of c.impacts) { if (m.glow) glow++; if (m.g) sparks++; } }
    window.__fxmod.setLowQuality(false);
    return { o0, o1, glow, sparks, tracer, flash, carried: window.__carried() };
  });
  check(`sustained STANDARD + OVERRIDE fire: display objects created once and reused (${r.o0} after warm-up, ${r.o1} after 600 more ticks)`, r.o1 <= r.o0 + 6 && r.o1 <= 90, JSON.stringify(r));
  check('low quality: tracers and the discharge drawn, no glow or scatter created; the rifle still carried', r.tracer > 0 && r.flash > 0 && r.glow === 0 && r.sparks === 0 && /^p1-rifle/.test(r.carried), JSON.stringify(r));
  await p.close();
}

// ── 10. FROZEN FILES ──────────────────────────────────────────────────────
if (on(10)) {
  console.log('\n== 10. frozen files');
  let diff = '';
  try { diff = execSync(`git diff --stat ${BASE_REV} -- src ':!src/systems/debug.js' ':!src/systems/p2aFx.js' ':!src/systems/p2aPaint.js' ':!src/systems/p2a2Loadout.js'`, { encoding: 'utf8' }).trim(); } catch (e) { diff = `git failed: ${e.message}`; }
  check(`src/: nothing changed against ${BASE_REV} outside debug.js, p2aFx.js, p2aPaint.js and the new p2a2Loadout.js (entities, Player, WeaponPickup, HUD, GameScene, PreloadScene, P1, FX, config untouched)`, diff === '', diff);
  const g = enemyJsGuard(process.cwd() + '/');
  check('Enemy.js guard (outside the Bomber, the Bomber-only veto)', g.outside && g.bomberOnlyVeto && g.vetoCode, g.detail);
}

// ── 11. AGAINST THE PREVIOUS BUILD ────────────────────────────────────────
if (OLD && !SELF && on(11)) {
  console.log(`\n== 11. against the previous build (${OLD})`);
  for (const [label, flags] of [['R1 (no flags)', ''], ['V2C', 'visualPilot=v2c'], ['P1', P1], ['P2-A', A]]) {
    const pOld = await boot(flags, { base: OLD }), pNew = await boot(flags);
    const tOld = await pOld.evaluate(() => window.__allTex()), tNew = await pNew.evaluate(() => window.__allTex());
    const dk = [...new Set([...Object.keys(tOld), ...Object.keys(tNew)])].filter((k) => tOld[k] !== tNew[k]);
    check(`${label}: every texture byte-identical to the previous build`, dk.length === 0, dk.join(' '));
    await pOld.close(); await pNew.close();
  }
  // P2-A's rendered output, pixel for pixel, over a staged sequence
  const frames = async (base, flags = A) => {
    const p = await boot(flags, { base });
    const r = await p.evaluate(async () => {
      const gs = window.__gs, P = gs.player;
      window.__stage(760, 810); window.__seed(55); window.__draws = 0;
      gs.spawnEnemyAt('grunt', 1000, 810); gs.spawnEnemyAt('shooter', 980, 700);
      const hashes = [];
      const fnv = (d) => { let h = 0x811c9dc5; for (let i = 0; i < d.length; i += 3) h = Math.imul(h ^ d[i], 16777619) >>> 0; return h.toString(16); };
      for (let i = 0; i < 60; i++) {
        if (i === 0) P.tryFire(0);
        if (i === 20) { P.secondary = 'rifle'; P.secondaryAmmo = 27; gs.events.emit('secondary-equipped', 'rifle'); P.fireCooldown = 0; P.tryFire(-0.4); }
        if (i === 40) { P.secondary = null; P.fireCooldown = 0; P.tryFire(-Math.PI / 2); }
        window.__adv(1);
        if (i % 2 === 0) hashes.push(fnv(await window.__grab(0, 84, 720, 1196)));
      }
      return { hashes, draws: window.__draws };
    });
    await p.close();
    return r;
  };
  const fo = await frames(OLD), fn = await frames(NOW);
  const df = firstDiff(fo.hashes, fn.hashes);
  check(`P2-A's RENDERED output is pixel-identical to the previous build over a staged pistol / rifle / wall sequence (${fo.hashes.length} frames)`, df < 0 && fo.draws === fn.draws, df < 0 ? '' : `first differing frame ${df}`);
  const fb = await frames(NOW, B);
  const same = fb.hashes.filter((h, i) => h === fo.hashes[i]).length;
  check(`CONTROL: the same pixel check FAILS for P2-A2 against the previous P2-A (${fo.hashes.length - same} of ${fo.hashes.length} frames differ) — it can see a change`, same < fo.hashes.length / 2 && fb.draws === fo.draws, `${same} identical frames`);
  for (const [label, q, oldFlags, newFlags] of [['SWARM TIDE, R1', Q_SWARM, '', ''], ['SWARM TIDE, P1', Q_SWARM, P1, P1], ['SWARM TIDE, P2-A', Q_SWARM, A, A], ['SWARM TIDE, B vs the previous P2-A', Q_SWARM, A, B], ['CROSSFIRE, B vs the previous P2-A', Q_CROSS, A, B], ['SWARM TIDE, R1 + ignored fxPilot=p2a2', Q_SWARM, '', 'fxPilot=p2a2']]) {
    const a = await replay(oldFlags, q, { base: OLD }), b = await replay(newFlags, q);
    const d = firstDiff(a.hashes, b.hashes);
    check(`${label}: ${TICKS} ticks identical to the previous build`, d < 0, d < 0 ? `${a.draws} draws` : `first divergent tick ${d}`);
  }
} else if (!SELF && on(11)) console.log('\n== 11. skipped (no --old=URL)');

// ── 12. RESTART AND RELOAD KEEP THE MODE ──────────────────────────────────
if (!SELF && on(12)) {
  console.log('\n== 12. restart and reload keep the mode');
  for (const [M, flags, want] of [['B', B, true], ['P2-A', A, false]]) {
    const p = await boot(flags);
    const after = await p.evaluate(() => {
      const gs = window.__gs;
      gs.scene.start('Game', { mode: 'endless', seed: 4242 });
      for (let i = 0; i < 600 && !(gs.roomSpec && gs.player?.active); i++) window.__adv(1);
      window.__adv(20);
      return { a2: window.__dbg.isFxP2A2(), loadout: !!gs._p2a?.loadout, layer: !!gs._p2a };
    });
    check(`${M}: a scene restart keeps the mode (loadout ${want ? 'installed' : 'absent'}, P2-A layer installed)`, after.a2 === want && after.loadout === want && after.layer, JSON.stringify(after));
    await p.reload();
    await p.waitForFunction(() => window.game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 60000 });
    const rl = await p.evaluate(async () => {
      const u = performance.getEntriesByType('resource').map((r) => r.name).find((n) => /systems\/debug\.js/.test(n));
      const d = await import(u);
      return { a2: d.isFxP2A2(), tex: window.game.textures.exists('p2a2-mz-s') };
    });
    check(`${M}: a reload keeps the mode (and paints the p2a2 set only when on)`, rl.a2 === want && rl.tex === want, JSON.stringify(rl));
    await p.close();
  }
}

await browser.close();
const fails = results.filter((r) => !r.ok);
console.log(`\n${results.length - fails.length}/${results.length} passed${SELF ? '  (SELFTEST: sections 3, 4 and 7 are expected to FAIL)' : ''}`);
if (SELF) {
  const must = ['one ordinary shot is one bolt', 'bursts:', 'headless ticks, B identical to P2-A'];
  const ok = must.every((m) => fails.some((f) => f.name.includes(m)));
  console.log(ok ? 'SELFTEST OK: the checks caught the injected changes' : 'SELFTEST FAILED: a check did not catch an injected change');
  process.exit(ok ? 0 : 1);
}
process.exit(fails.length ? 1 : 0);
