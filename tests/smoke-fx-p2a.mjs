// SMOKE: P2-A — BLASTER FIRE & IMPACT (`?visualPilot=v2c&polish=p1&fxPilot=p2a`) —
// PRESENTATION ONLY, PROVEN AGAINST THE APPROVED P1 PRESENTATION.
// Standalone; needs `npm run dev` on :5173 and, for section 11, the PREVIOUS
// build — `def85e5`, the P1-approved build — on another port (`--old=URL`).
//
// A = `visualPilot=v2c&polish=p1` (approved, frozen), B = A + `fxPilot=p2a`.
// Nothing here says whether P2-A looks better (the handset's job); it proves
// that it is what it claims to be:
//   0  THE FLAG: honoured only with P1 live (v2c + p1); every other combination
//      is that mode exactly; it moves no gameplay switch, the pilot or P1
//   1  TEXTURES: B paints every A texture byte-identically (`bullet`, whose
//      width is the hitbox, included) and adds exactly the twelve `p2a-*`
//   2  INSTALL: exactly one POST_UPDATE and one shutdown listener; exactly the
//      named instance wrappers (two group `fire`s, five scene methods, six fx
//      methods); A has none of it
//   3  PROJECTILES: 8 bearings x pistol and rifle — every bolt's position,
//      bearing, velocity, scale, texture, body radius and offset, damage,
//      range, knockback and owner are A's; under B the bolt is not drawn, its
//      tracer head sits on it, its tail never reaches behind the barrel face;
//      the muzzle is drawn at the live P1 barrel face, the shipped flash is not
//   4  CONTACTS: a body hit lands on the body's rim on the flight line, an
//      armoured one is marked armour, a wall hit on the collider's face with
//      its outward normal toward the shooter and over the cover art, a block
//      by a bearer without the field is a SHIELD contact (no damage, no Super
//      credit, no body contact), a field block draws nothing of P2-A's and its
//      tracer ends on the field, a miss draws no contact at all; every outcome
//      (hp, Super charge, miss events, field blocks) is A's
//   5  SAME FIGHT: seeded replays — every tick's player / camera / enemy /
//      bullet state and Math.random draw count — A vs B with pistol, rifle,
//      Supers and melee: SWARM TIDE (production and legacy baselines),
//      CROSSFIRE and BOMBER RUN, headless and rendered, and in LOW quality;
//      each ignored `fxPilot=p2a` mode vs its own mode
//   6  READER ONLY: P2-A's frame draws no Math.random, writes no clock, camera,
//      body or bolt field; under a hitstop its effects freeze with the world
//   7  CLEANUP: 3 restarts + quit-to-title leave no P2-A object, wrapper or
//      listener behind and install exactly one fresh layer; a paused scene
//      freezes it
//   8  LOW QUALITY: no scatter, no glows; tracers and contacts still drawn
//   9  BUDGET: no display-object growth under sustained fire once warm; live
//      contacts capped at 14 however many land in a frame
//  10  FROZEN FILES: no change against `def85e5` outside the seam; the Enemy.js
//      guard holds
//  11  AGAINST THE PREVIOUS BUILD (`--old`): R1, V2C and P1 textures and fights
//      are that build's; B's fight is that build's P1 fight
//  12  restart and reload keep the mode
// `--selftest` injects, in B only, a Math.random draw in the P2-A frame, a 1px
// shift of the pistol bolt, and a broken parity twin: sections 3, 5 and 6 must
// FAIL.
//
// usage: node tests/smoke-fx-p2a.mjs [--old=URL] [--selftest] [--ticks=N] [--only=0,3]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { execSync } from 'node:child_process';
import { CHROME, bootPage, FIGHT_SEG } from './diag-stuck-audit.mjs';
import { enemyJsGuard } from './enemy-frozen.mjs';

const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const SELF = process.argv.includes('--selftest');
const OLD = opt('old', null);
const NOW = 'http://localhost:5173/';
const TICKS = +opt('ticks', '1500');
const BASE_REV = 'def85e5';
const A = 'visualPilot=v2c&polish=p1', B = 'visualPilot=v2c&polish=p1&fxPilot=p2a';
const Q_SWARM = 'encdbg=swarmTide&room=hangar&sector=3';
const Q_CROSS = 'encdbg=crossfire&room=hangar&sector=6';
const Q_BOMB = 'encdbg=bomberRun&room=hangar&sector=4';
const P2A_KEYS = ['p2a-glow', 'p2a-head-p', 'p2a-head-r', 'p2a-hit-a', 'p2a-hit-b', 'p2a-hit-s', 'p2a-hit-w', 'p2a-mz-p', 'p2a-mz-r0', 'p2a-mz-r1', 'p2a-tail-p', 'p2a-tail-r'];
const ONLY = opt('only', '') ? new Set(opt('only', '').split(',').map(Number)) : null;
const on = (n) => !ONLY || ONLY.has(n);

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`); };
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const isB = (flags) => /fxPilot=p2a/.test(flags) && /polish=p1/.test(flags) && /visualPilot=v2c/.test(flags);

// ── in-page instruments ───────────────────────────────────────────────────
async function instrument(p, flags) {
  await p.evaluate(async ({ self, b }) => {
    const gs = window.__gs;
    const fnv = (str) => { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0; return h; };
    window.__dbg = await window.__mod(/systems\/debug\.js/);
    window.__fxmod = await window.__mod(/systems\/FX\.js/);
    if (self && b) {
      // what a careless P2-A would do — injected in B only
      const c = gs._p2a; const u = c.update.bind(c); c.update = (t, d) => { Math.random(); u(t, d); };
      const fp = gs.firePlayerPrimary.bind(gs);
      gs.firePlayerPrimary = (a) => { const x = gs.player.x; gs.player.x += 1; fp(a); gs.player.x = x; };
      c._parity = () => {}; c._parityDir = () => {};
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
    };
    // the room's scheduled banners and terminal hints are over; the hero is placed
    window.__stage = (x, y) => {
      window.__clearArena();
      window.__headless = true; window.__adv(300); window.__headless = false;
      window.__clearArena();
      const P = gs.player; P.x = x; P.y = y; P.body.reset(x, y); P.fireCooldown = 0; P.ammo = 99; P.secondary = null;
      window.__adv(30);
    };
    // A seeded replay folding the gameplay state of every tick into one hash.
    window.__trace = ({ seed, ticks, seg, headless, melee, rifleAt, superAt, low }) => {
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
        if (i === rifleAt) { P.secondary = 'rifle'; P.secondaryAmmo = 90; gs.events.emit('secondary-equipped', 'rifle'); }
        window.__adv(1);
        let s = `${i}|${f(P.x)},${f(P.y)},${P.hp},${f(P.body.center.x)},${f(P.body.center.y)},${P.superCharge},${P.meleeCharge},${P.ammo},${P.secondaryAmmo}|${f(cam.scrollX)},${f(cam.scrollY)},${f(cam.zoom)}|${f(gs.time.timeScale)}|`;
        for (const e of gs.enemies.getChildren()) if (e.active) s += `${e.enemyType}:${f(e.x)},${f(e.y)},${Math.round(e.hp)},${f(e.body.center.x)},${f(e.body.center.y)};`;
        for (const g of [...gs.hostileBullets, gs.playerBullets, gs.playerRifleBullets, gs.playerSuperBullets]) {
          for (const bb of g?.getChildren?.() || []) if (bb.active) s += `b${f(bb.x)},${f(bb.y)},${f(bb.body.velocity.x)},${f(bb.body.velocity.y)},${bb.damage};`;
        }
        s += `|d${window.__draws}`;
        hashes.push(fnv(s));
      }
      const K2 = gs.keys; K2.A.isDown = K2.D.isDown = K2.W.isDown = K2.S.isDown = false;
      if (low) window.__fxmod.setLowQuality(false);
      const st = gs._p2a?.stats;
      return { hashes, draws: window.__draws, spawned: gs.enemies.getChildren().length, stats: st ? JSON.parse(JSON.stringify(st)) : null };
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
  const cases = [['', false, false], ['fxPilot=p2a', false, false], ['visualPilot=v2c&fxPilot=p2a', false, false], ['visualPilot=v2&polish=p1&fxPilot=p2a', false, false],
    ['visualPilot=v2b&polish=p1&fxPilot=p2a', false, false], [A, false, true], [B, true, true], [`${A}&fxPilot=P2A`, false, true], [`${A}&fxPilot=p2b`, false, true],
    [`${A}&fxPilot=1`, false, true], [`baseline=legacy&${B}`, true, true]];
  const sw = {};
  for (const [flags, want, p1] of cases) {
    const p = await boot(flags);
    const r = await p.evaluate(() => {
      const d = window.__dbg, gs = window.__gs;
      return { p2a: d.isFxP2A(), p1: d.isPolishP1(), inst: !!gs._p2a, base: d.getGameplayBaseline(), vp: d.getVisualPilot(),
        sw: [d.isRosterV1(), d.isMoveV22(), d.isGaitV2(), d.getBulwarkStuck(), d.getMarksmanStuck(), d.isMarksmanAngle(), d.isBulwarkAngle()].join(',') };
    });
    check(`?${flags || '(no flags)'} -> P2-A ${want ? 'ON' : 'off'}, P1 ${p1 ? 'on' : 'off'}`, r.p2a === want && r.inst === want && r.p1 === p1, JSON.stringify({ p2a: r.p2a, inst: r.inst, p1: r.p1, vp: r.vp }));
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
  check(`B: every A texture byte-identical (${Object.keys(tA).length}, the P1 set, roster and FX included)`, changed.length === 0, changed.join(' '));
  check('B: `bullet` (the bolt\'s hitbox texture) is 60px wide and identical to A', tA.bullet === tB.bullet && /^60x15:/.test(tB.bullet), tB.bullet);
  check(`B: the added textures are exactly the ${P2A_KEYS.length} p2a-* keys`, JSON.stringify(added) === JSON.stringify(P2A_KEYS), added.join(' '));
  for (const [label, base, ign] of [['R1', '', 'fxPilot=p2a'], ['V2C', 'visualPilot=v2c', 'visualPilot=v2c&fxPilot=p2a'], ['V2B + polish', 'visualPilot=v2b&polish=p1', 'visualPilot=v2b&polish=p1&fxPilot=p2a']]) {
    const t0 = await tex(base), t1 = await tex(ign);
    const keys = [...new Set([...Object.keys(t0), ...Object.keys(t1)])];
    const d = keys.filter((k) => t0[k] !== t1[k]);
    check(`${label} + ignored fxPilot=p2a: every texture byte-identical, no p2a key`, d.length === 0 && !Object.keys(t1).some((k) => k.startsWith('p2a-')), d.join(' '));
  }
}

// ── 2. INSTALL ────────────────────────────────────────────────────────────
const SCENE_WRAPS = ['_impactMicroFlash', 'firePlayerPrimary', 'firePlayerRifle', 'handleBulletEnemyHits', 'handleBulletWallHits'];
const installState = (p) => p.evaluate((names) => {
  const gs = window.__gs, ev = gs.events;
  const out = {};
  for (const n of ev.eventNames()) out[String(n)] = ev.listenerCount(n);
  const own = names.filter((k) => Object.prototype.hasOwnProperty.call(gs, k));
  const groups = [gs.playerBullets, gs.playerRifleBullets, gs.playerSuperBullets, gs.playerFragBullets, gs.enemyBullets, gs.deflectedBullets].map((g) => Object.prototype.hasOwnProperty.call(g, 'fire'));
  return { game: out, own, groups, wraps: gs._p2a?._wrapped?.length ?? 0, inst: !!gs._p2a };
}, SCENE_WRAPS);
if (on(2)) {
  console.log('\n== 2. install');
  const pA = await boot(A), pB = await boot(B);
  const lA = await installState(pA), lB = await installState(pB);
  const ev = [...new Set([...Object.keys(lA.game), ...Object.keys(lB.game)])];
  const diff = ev.filter((k) => (lA.game[k] || 0) !== (lB.game[k] || 0)).map((k) => `${k}:${lA.game[k] || 0}->${lB.game[k] || 0}`);
  check('B adds exactly one POST_UPDATE and one shutdown listener; every other game event as A', diff.length === 2 && ['postupdate', 'shutdown'].every((k) => (lB.game[k] || 0) === (lA.game[k] || 0) + 1), diff.join(' '));
  check('B wraps exactly the five scene methods on the instance; A none', JSON.stringify(lB.own) === JSON.stringify(SCENE_WRAPS) && lA.own.length === 0, `${lA.own} / ${lB.own}`);
  check('B wraps `fire` on the pistol and rifle groups only (Super, frag, enemy, deflected untouched); A none', JSON.stringify(lB.groups) === JSON.stringify([true, true, false, false, false, false]) && lA.groups.every((x) => !x), JSON.stringify(lB.groups));
  check('B: thirteen wrappers in all (2 groups + 5 scene + 6 fx: muzzleFlash, hitFlash, impactRing, burst, burstDir, healingSparkle)', lB.wraps === 13 && lB.inst && !lA.inst, `${lB.wraps}`);
  await pA.close(); await pB.close();
}

// ── 3. PROJECTILES AND THE MUZZLE ──────────────────────────────────────────
if (on(3)) {
  console.log('\n== 3. projectiles and the muzzle');
  const BEAR = [0, 0.7, 1.6, 2.5, 3.1, -0.4, -1.57, -2.4];
  const shots = async (flags) => {
    const p = await boot(flags);
    const s = await p.evaluate((bear) => {
      const gs = window.__gs, P = gs.player, c = gs._p2a;
      window.__stage(800, 760); window.__seed(77); window.__draws = 0;
      const out = [], tr = [], mz = [];
      const f = (v) => v.toFixed(3);
      const grab = (g) => g.getChildren().filter((b) => b.active).map((b) => [f(b.x), f(b.y), b.rotation.toFixed(4), f(b.body.velocity.x), f(b.body.velocity.y), b.scaleX.toFixed(4), b.scaleY.toFixed(4),
        b.texture.key, b.body.radius, f(b.body.offset.x), f(b.body.offset.y), b.damage, b.range, b.knockback, b.owner, b.piercing].join(',')).sort().join(' ');
      const muzzleImgs = () => gs.children.list.filter((o) => o.texture?.key === 'muzzle' && o.visible && o.alpha > 0).length;
      const tracerCheck = (g) => {
        if (!c) return null;
        let worst = 0, behind = 0, shown = 0, hid = 0, n = 0;
        for (const b of g.getChildren()) {
          if (!b.active) continue;
          const r = c.bolts.find((q) => q.b === b && q.gen === b._gen && !q.dead);
          if (!r) { worst = 999; continue; }
          n++;
          if (b.visible) shown++;
          if (r.head.visible) worst = Math.max(worst, Math.hypot(r.head.x - b.x, r.head.y - b.y));
          if (r.tail.visible) {
            // the tail's back end, along the shot from the barrel face
            const len = r.tail.scaleX * r.cfg.tailTex.w;
            const bx = r.tail.x - Math.cos(r.tail.rotation) * len, by = r.tail.y - Math.sin(r.tail.rotation) * len;
            const along = (bx - r.ox) * Math.cos(r.ang) + (by - r.oy) * Math.sin(r.ang);
            behind = Math.min(behind, along);
          } else hid++;
        }
        return { worst, behind, shown, n, hid };
      };
      for (const a of bear) {
        P.fireCooldown = 0; P.ammo = 99; P.secondary = null; P.tryFire(a);
        window.__adv(1);
        out.push(`p${a}:${grab(gs.playerBullets)}`);
        tr.push(tracerCheck(gs.playerBullets));
        if (c) {
          const f0 = c.flashes[c.flashes.length - 1], m = c._muzzle(), w = gs._p1Player.weapon;
          mz.push({ kind: 'pistol', at: f0 ? Math.hypot(f0.img.x - m.x, f0.img.y - m.y) : 999, tip: Math.hypot(m.x - w.x, m.y - w.y), above: f0 ? f0.img.depth > w.depth : false, shipped: muzzleImgs() });
        } else mz.push({ shipped: muzzleImgs() });
        window.__adv(30);
        P.fireCooldown = 0; P.secondary = 'rifle'; P.secondaryAmmo = 9; P.tryFire(a);
        for (let k = 0; k < 12; k++) { window.__adv(1); if (k === 1 && c) { const f0 = c.flashes[c.flashes.length - 1], m = c._muzzle(); mz.push({ kind: 'rifle', at: f0 ? Math.hypot(f0.img.x - m.x, f0.img.y - m.y) : 999, tip: Math.hypot(m.x - gs._p1Player.weapon.x, m.y - gs._p1Player.weapon.y), above: f0 ? f0.img.depth > gs._p1Player.weapon.depth : false, shipped: muzzleImgs() }); } }
        out.push(`r${a}:${grab(gs.playerRifleBullets)}`);
        tr.push(tracerCheck(gs.playerRifleBullets));
        window.__adv(60);
      }
      return { out, tr, mz, draws: window.__draws };
    }, BEAR);
    await p.close();
    return s;
  };
  const sA = await shots(A), sB = await shots(B);
  const d = sA.out.findIndex((x, i) => x !== sB.out[i]);
  const empty = sA.out.filter((x) => !x.split(':')[1]).map((x) => x.split(':')[0]);
  check(`every pistol and rifle bolt: position, bearing, velocity, scale (the tracer stretch), texture, body radius + offset, damage, range, knockback, owner = A's (${BEAR.length} bearings, ${sA.out.length} volleys) with A's draw count`,
    d < 0 && sA.draws === sB.draws && empty.length === 0,
    d < 0 ? `draws ${sA.draws} / ${sB.draws}; volleys with no live bolt: ${empty.join(' ') || 'none'}` : `first difference: ${sA.out[d]?.slice(0, 90)} vs ${sB.out[d]?.slice(0, 90)}`);
  check('the bolt\'s body radius is the `bullet` texture\'s half-width (30) in A and B', sA.out.every((x) => !x.split(':')[1] || x.split(':')[1].split(' ').every((b) => b.split(',')[8] === '30')) && sB.out.every((x) => !x.split(':')[1] || x.split(':')[1].split(' ').every((b) => b.split(',')[8] === '30')));
  const tB = sB.tr.filter(Boolean);
  check('B: every live bolt has a tracer; the bolt sprite itself is never drawn', tB.length === sB.tr.length && tB.every((t) => t.shown === 0 && t.n > 0 && t.worst < 999), JSON.stringify(tB.slice(0, 3)));
  check('B: the tracer head sits on the bolt (< 0.01px) and the tail never reaches behind the barrel face', tB.every((t) => t.worst < 0.01 && t.behind > -0.5), `worst head ${Math.max(...tB.map((t) => t.worst)).toFixed(4)}px, tail ${Math.min(...tB.map((t) => t.behind)).toFixed(2)}px`);
  const mB = sB.mz.filter((m) => m.kind);
  check('B: the muzzle flash is pinned to the live P1 barrel face (pistol 30px, rifle 42px past the weapon origin) and drawn over the weapon', mB.length === 16 && mB.every((m) => m.at < 0.01 && m.above && Math.abs(m.tip - (m.kind === 'rifle' ? 42 : 30)) < 0.01), JSON.stringify(mB.slice(0, 2)));
  check('the shipped muzzle flash: drawn in A for every shot, never in B', sA.mz.every((m) => m.shipped > 0) && sB.mz.every((m) => m.shipped === 0), `A ${sA.mz.map((m) => m.shipped).join('')} / B ${sB.mz.map((m) => m.shipped).join('')}`);
}

// ── 4. CONTACTS ───────────────────────────────────────────────────────────
// Staged single shots. Each returns the gameplay outcome (compared A vs B) and,
// under B, what P2-A drew.
const CONTACTS = {
  body: { x: 760, y: 810, setup: `T.e = gs.spawnEnemyAt('grunt', 1000, 810);`, fire: `P.tryFire(Math.atan2(T.e.y - P.y, T.e.x - P.x));` },
  armour: { x: 760, y: 810, setup: `T.e = gs.spawnEnemyAt('grunt', 1000, 810, { elite: true });`, fire: `P.tryFire(Math.atan2(T.e.y - P.y, T.e.x - P.x));` },
  rifle: { x: 760, y: 810, setup: `T.e = gs.spawnEnemyAt('shooter', 1000, 810); P.secondary = 'rifle'; P.secondaryAmmo = 27;`, fire: `P.tryFire(Math.atan2(T.e.y - P.y, T.e.x - P.x));` },
  wall: { x: 840, y: 620, setup: ``, fire: `P.tryFire(-Math.PI / 2);` },
  wallDiag: { x: 760, y: 600, setup: ``, fire: `P.tryFire(Math.atan2(380 - 600, 840 - 760));` },
  bare: { x: 780, y: 810, pre: 70, setup: `T.e = gs.spawnEnemyAt('shielded', 1010, 810, { legacyArt: true });`, fire: `P.tryFire(Math.atan2(T.e.y - P.y, T.e.x - P.x));` },
  field: { x: 780, y: 810, pre: 70, setup: `T.e = gs.spawnEnemyAt('shielded', 1010, 810);`, fire: `P.tryFire(Math.atan2(T.e.y - P.y, T.e.x - P.x));` },
  miss: { x: 760, y: 810, setup: ``, fire: `P.tryFire(0);` },
};
async function contact(flags, name) {
  const C = CONTACTS[name];
  const p = await boot(flags);
  const r = await p.evaluate(({ C, name }) => {
    const gs = window.__gs, P = gs.player, c = gs._p2a, T = {};
    window.__stage(C.x, C.y);
    window.__seed(31); window.__draws = 0;
    new Function('gs', 'P', 'T', C.setup)(gs, P, T);
    if (C.pre) { window.__headless = true; window.__adv(C.pre); window.__headless = false; }
    let missed = 0; const onMiss = () => missed++; gs.events.on('player-shot-missed', onMiss);
    const hp0 = T.e?.hp, sc0 = P.superCharge;
    const blocks0 = T.e?._curtain?.stats?.blocks ?? 0;
    const seen = [];
    const imp0 = c ? c.impacts.length : 0;
    let bolt = null;
    new Function('gs', 'P', 'T', C.fire)(gs, P, T);
    for (let i = 0; i < 40; i++) {
      window.__adv(1);
      if (c) {
        // positions are read on the tick the contact is drawn: the target is
        // knocked back and keeps walking afterwards
        for (const m of c.impacts) if (!seen.includes(m)) { seen.push(m); m._px = m.x; m._py = m.y; m._ex = T.e?.x; m._ey = T.e?.y; m._eDepth = T.e?.depth; }
        if (!bolt) bolt = c.bolts.find((q) => q.kind && !q.dead) || null;
      }
      if (bolt && bolt.dead && bolt.endSeen == null) bolt.endSeen = { x: bolt.endX, y: bolt.endY, ex: T.e?.x, ey: T.e?.y };
    }
    gs.events.off('player-shot-missed', onMiss);
    const e = T.e;
    const out = { hp: [hp0, e?.hp], sc: [sc0, P.superCharge], missed, blocks: (e?._curtain?.stats?.blocks ?? 0) - blocks0, draws: window.__draws };
    if (c) {
      out.impacts = seen.map((m) => {
        const o = { kind: m.kind, x: m._px, y: m._py, rot: m.rot, depth: m.depth };
        if (e) { o.dist = Math.hypot(m._px - m._ex, m._py - m._ey); o.r = e.cfg.radius; o.eDepth = m._eDepth; }
        return o;
      });
      out.end = bolt?.endSeen || null;
      out.bearer = e ? { x: e.x, y: e.y } : null;
      out.ang = bolt?.ang;
      out.parity = c.stats.parity;
      if (name.startsWith('wall')) {
        const w = c._wallAt(seen[0]?.x - Math.cos(seen[0]?.rot) * 0.5, seen[0]?.y - Math.sin(seen[0]?.rot) * 0.5);
        out.wall = w;
        const cover = gs.walls.getChildren().find((q) => w && Math.abs((q.body.x + q.body.width / 2) - w.cx) < 0.01 && Math.abs((q.body.y + q.body.height / 2) - w.cy) < 0.01);
        out.coverDepth = cover?.depth;
      }
    }
    return out;
  }, { C, name });
  await p.close();
  return r;
}
if (on(4)) {
  console.log('\n== 4. contacts');
  const R = {};
  for (const n of Object.keys(CONTACTS)) {
    const a = await contact(A, n), b = await contact(B, n);
    R[n] = b;
    const same = JSON.stringify([a.hp, a.sc, a.missed, a.blocks, a.draws]) === JSON.stringify([b.hp, b.sc, b.missed, b.blocks, b.draws]);
    check(`${n}: the outcome (hp, Super charge, miss events, field blocks, draws) is A's`, same, `A ${JSON.stringify([a.hp, a.sc, a.missed, a.blocks, a.draws])} / B ${JSON.stringify([b.hp, b.sc, b.missed, b.blocks, b.draws])}`);
  }
  const k = (n) => R[n].impacts.map((m) => m.kind).join(',');
  const body = R.body.impacts[0];
  check('body: one BODY contact, on the body\'s rim (|d - radius| < 1px) on the flight line, over the struck body', k('body') === 'body' && Math.abs(body.dist - body.r) < 1 && Math.abs(body.rot - R.body.ang) < 1e-6 && body.depth > body.eDepth && R.body.hp[1] < R.body.hp[0],
    JSON.stringify(body));
  check('body: the bolt\'s tracer ends AT the contact, not in the air in front of him', R.body.end && Math.hypot(R.body.end.x - body.x, R.body.end.y - body.y) < 0.01, JSON.stringify(R.body.end));
  check('armour (an Elite): one ARMOUR contact on the rim', k('armour') === 'armour' && Math.abs(R.armour.impacts[0].dist - R.armour.impacts[0].r) < 1, k('armour'));
  check('rifle burst into a Gunner: a BODY contact per bolt that landed, each on the rim', R.rifle.impacts.length >= 1 && R.rifle.impacts.every((m) => m.kind === 'body' && Math.abs(m.dist - m.r) < 1), JSON.stringify(R.rifle.impacts.map((m) => [m.kind, m.dist?.toFixed(2)])));
  for (const n of ['wall', 'wallDiag']) {
    const m = R[n].impacts[0], w = R[n].wall;
    const onFace = w && (Math.abs(Math.abs(m.x - w.cx) - w.hw) < 0.01 || Math.abs(Math.abs(m.y - w.cy) - w.hh) < 0.01);
    const towardShooter = Math.cos(m.rot) * -Math.cos(R[n].ang) + Math.sin(m.rot) * -Math.sin(R[n].ang) > 0;
    check(`${n}: one WALL contact on the collider's face, its normal toward the shooter, drawn over the cover art`, k(n) === 'wall' && onFace && towardShooter && m.depth > R[n].coverDepth, JSON.stringify({ m, w, coverDepth: R[n].coverDepth }));
  }
  check('a block by a bearer WITHOUT the field: one SHIELD contact, no body contact, no damage, no Super credit', k('bare') === 'shield' && R.bare.hp[0] === R.bare.hp[1] && R.bare.sc[0] === R.bare.sc[1], JSON.stringify({ k: k('bare'), hp: R.bare.hp, sc: R.bare.sc }));
  const fe = R.field.end, fb = fe ? { x: fe.ex, y: fe.ey } : null;
  check('a block by the roster-v1 field: the field draws it (blocks +1 in A and B), P2-A draws no contact, and the tracer ends ON the field (46px)', R.field.blocks === 1 && R.field.impacts.length === 0 && fe && Math.abs(Math.hypot(fe.x - fb.x, fe.y - fb.y) - 46) < 1.5,
    JSON.stringify({ blocks: R.field.blocks, impacts: R.field.impacts.length, endR: fe && Math.hypot(fe.x - fb.x, fe.y - fb.y) }));
  check('a miss at range: no contact drawn (no misleading feedback), and it is still a miss', R.miss.impacts.length === 0 && R.miss.missed === 1, JSON.stringify({ impacts: R.miss.impacts.length, missed: R.miss.missed }));
}

// ── 5. SAME FIGHT ─────────────────────────────────────────────────────────
const SUPER = [700, 1400], MELEE = [320, 345, 370, 1000, 1030], RIFLE = 520;
async function replay(flags, q, { headless = true, ticks = TICKS, seed = 9071, base = NOW, low = false } = {}) {
  const p = await boot(flags, { base, q });
  const r = await p.evaluate((o) => window.__trace(o), { seed, ticks, seg: FIGHT_SEG, headless, melee: MELEE, rifleAt: RIFLE, superAt: SUPER, low });
  await p.close();
  return r;
}
if (on(5)) {
  console.log('\n== 5. same fight');
  for (const [label, q, base] of [['SWARM TIDE, production', Q_SWARM, ''], ['SWARM TIDE, legacy baseline', Q_SWARM, 'baseline=legacy'], ['CROSSFIRE, production', Q_CROSS, ''], ['BOMBER RUN, production', Q_BOMB, '']]) {
    const a = await replay([base, A].filter(Boolean).join('&'), q);
    const b = await replay([base, B].filter(Boolean).join('&'), q);
    const d = firstDiff(a.hashes, b.hashes);
    const st = b.stats || {};
    const ran = st.bolts > 0 && Object.values(st.impacts || {}).reduce((x, y) => x + y, 0) > 0;
    check(`${label}: ${TICKS} headless ticks, B identical to A (state + draws; pistol, rifle, 2 Supers, 2 melee chains)`, d < 0 && ran,
      d < 0 ? `${a.draws} draws; P2-A drew ${st.bolts} tracers, contacts ${JSON.stringify(st.impacts)}, parity ${st.parity}` : `first divergent tick ${d}`);
  }
  const n = Math.min(TICKS, 500);
  const a = await replay(A, Q_SWARM, { headless: false, ticks: n }), b = await replay(B, Q_SWARM, { headless: false, ticks: n });
  const d = firstDiff(a.hashes, b.hashes);
  check(`SWARM TIDE, production: ${n} RENDERED ticks, B identical to A`, d < 0 && b.stats.bolts > 0, d < 0 ? `${a.draws} draws` : `first divergent tick ${d}`);
  const al = await replay(A, Q_CROSS, { headless: false, ticks: n, low: true }), bl = await replay(B, Q_CROSS, { headless: false, ticks: n, low: true });
  const dl = firstDiff(al.hashes, bl.hashes);
  check(`CROSSFIRE in LOW quality: ${n} rendered ticks, B identical to A`, dl < 0 && bl.stats.bolts > 0, dl < 0 ? `${al.draws} draws` : `first divergent tick ${dl}`);
  for (const [label, base, ign] of [['R1', '', 'fxPilot=p2a'], ['V2C', 'visualPilot=v2c', 'visualPilot=v2c&fxPilot=p2a']]) {
    const m = Math.min(TICKS, 800);
    const x = await replay(base, Q_SWARM, { ticks: m }), y = await replay(ign, Q_SWARM, { ticks: m });
    const dd = firstDiff(x.hashes, y.hashes);
    check(`${label} + ignored fxPilot=p2a: ${m} ticks identical to ${label}`, dd < 0, dd < 0 ? '' : `first divergent tick ${dd}`);
  }
}

// ── 6. READER ONLY ────────────────────────────────────────────────────────
if (on(6)) {
  console.log('\n== 6. reader only');
  const p = await boot(B, { q: Q_SWARM });
  const r = await p.evaluate(() => {
    const gs = window.__gs, P = gs.player, c = gs._p2a, cam = gs.cameras.main;
    let inside = 0, maxLive = 0, wrote = [];
    const u = c.update.bind(c);
    c.update = (t, d) => {
      const before = [gs.time.timeScale, gs.physics.world.timeScale, cam.scrollX, cam.scrollY, cam.zoom, P.x, P.y, P.body.velocity.x, P.body.velocity.y].join();
      const bolts = [gs.playerBullets, gs.playerRifleBullets].flatMap((g) => g.getChildren().filter((b) => b.active).map((b) => [b.x, b.y, b.body.velocity.x, b.body.velocity.y, b.scaleX, b.body.radius, b.damage].join()));
      const d0 = window.__draws;
      u(t, d);
      inside += window.__draws - d0;
      const after = [gs.time.timeScale, gs.physics.world.timeScale, cam.scrollX, cam.scrollY, cam.zoom, P.x, P.y, P.body.velocity.x, P.body.velocity.y].join();
      const bolts2 = [gs.playerBullets, gs.playerRifleBullets].flatMap((g) => g.getChildren().filter((b) => b.active).map((b) => [b.x, b.y, b.body.velocity.x, b.body.velocity.y, b.scaleX, b.body.radius, b.damage].join()));
      if (before !== after || bolts.join('|') !== bolts2.join('|')) wrote.push(window.__draws);
      maxLive = Math.max(maxLive, c.bolts.length + c.impacts.length + c.flashes.length);
    };
    window.__seed(5); window.__draws = 0;
    for (let i = 0; i < 400; i++) { if (i % 5 === 0) P.keyboardFire(); if (i === 200) { P.secondary = 'rifle'; P.secondaryAmmo = 60; } window.__adv(1); }
    // hitstop: effects freeze with the world
    P.secondary = null; P.fireCooldown = 0; P.tryFire(0); window.__adv(1);
    const m = c.impacts[0] || null, f = c.flashes[0] || null;
    const age0 = f ? f.age : null;
    gs.fx.hitstop(80, 0.06);
    window.__adv(1);
    const age1 = f ? f.age : null;
    gs.fx.cancelHitstop();
    return { inside, wrote: wrote.length, maxLive, stats: c.stats, frozen: f ? (age1 - age0) : null, ts: gs.time.timeScale };
  });
  await p.close();
  check(`P2-A's frame draws no Math.random over 400 ticks of fighting (${r.stats.bolts} tracers, ${JSON.stringify(r.stats.impacts)} contacts)`, r.inside === 0 && r.stats.bolts > 20, `${r.inside} draws inside the hook`);
  check('P2-A\'s frame writes no clock, physics scale, camera, player or bolt field', r.wrote === 0, `${r.wrote} frames changed something`);
  check('under a hitstop (timeScale 0.06) a muzzle flash ages at the world\'s rate (<= 1.1ms per 16.7ms frame)', r.frozen != null && r.frozen <= 1.1, `aged ${r.frozen?.toFixed(2)}ms`);
}

// ── 7. CLEANUP ────────────────────────────────────────────────────────────
if (on(7)) {
  console.log('\n== 7. cleanup');
  const p = await boot(B);
  const lk = await p.evaluate((names) => {
    const g = window.game;
    const sample = () => {
      const gs = g.scene.getScene('Game');
      const L = gs.children.list;
      const p2a = L.filter((o) => o.texture?.key?.startsWith?.('p2a-')).length;
      return { p2a, post: gs.events.listenerCount('postupdate'), shut: gs.events.listenerCount('shutdown'), own: names.filter((k) => Object.prototype.hasOwnProperty.call(gs, k)).length, wraps: gs._p2a?._wrapped?.length, inst: !!gs._p2a };
    };
    const wait = () => { const gs = g.scene.getScene('Game'); for (let i = 0; i < 600 && !(gs.roomSpec && gs.player?.active && gs._p2a); i++) window.__adv(1); window.__adv(60); };
    const fire = () => { const gs = g.scene.getScene('Game'); for (let i = 0; i < 40; i++) { if (i % 4 === 0) { gs.player.fireCooldown = 0; gs.player.tryFire(i * 0.3); } window.__adv(1); } };
    const out = [];
    let old = g.scene.getScene('Game')._p2a;
    fire();
    for (let k = 0; k < 3; k++) {
      const gs = g.scene.getScene('Game');
      gs.scene.start('Game', { mode: 'endless', seed: 4242 }); wait();
      const s = sample(); s.oldDead = !old.scene; old = g.scene.getScene('Game')._p2a; fire(); window.__adv(60); s.after = sample().p2a; out.push(s);
    }
    g.scene.getScene('Game').scene.stop('HUD'); g.scene.getScene('Game').scene.start('Title'); window.__adv(10);
    const title = { own: names.filter((k) => Object.prototype.hasOwnProperty.call(g.scene.getScene('Game'), k)).length };
    g.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 4242 }); wait();
    const t = sample(); t.oldDead = !old.scene; out.push(t);
    // pause: effects hold
    const gs = g.scene.getScene('Game'), c = gs._p2a;
    gs.player.fireCooldown = 0; gs.player.tryFire(0); window.__adv(1);
    const f = c.flashes[0]; const a0 = f?.age;
    gs.scene.pause(); window.__adv(10); const a1 = f?.age; gs.scene.resume(); window.__adv(1);
    return { out, title, paused: f ? a1 - a0 : null };
  }, SCENE_WRAPS);
  const ok = lk.out.every((s) => s.inst && s.oldDead && s.own === 5 && s.wraps === 13 && s.post === lk.out[0].post && s.shut === lk.out[0].shut);
  check('3 restarts + quit-to-title: the old layer destroyed, exactly one fresh layer (5 scene + 13 wrappers), listener counts steady', ok, JSON.stringify(lk.out.map((s) => [s.inst, s.oldDead, s.own, s.wraps, s.post, s.shut])));
  check('at the title screen the Game scene carries no P2-A wrapper', lk.title.own === 0, JSON.stringify(lk.title));
  check('after each restart the P2-A display objects are pooled, not leaked (bounded after firing)', lk.out.slice(0, 3).every((s) => s.after <= 48), JSON.stringify(lk.out.map((s) => s.after)));
  check('a paused scene freezes P2-A (a live flash does not age)', lk.paused === 0, `aged ${lk.paused}ms`);
  await p.close();
}

// ── 8. LOW QUALITY ────────────────────────────────────────────────────────
if (on(8)) {
  console.log('\n== 8. low quality');
  const p = await boot(B);
  const r = await p.evaluate(() => {
    const gs = window.__gs, P = gs.player, c = gs._p2a;
    window.__stage(760, 810);
    window.__fxmod.setLowQuality(true);
    const e = gs.spawnEnemyAt('grunt', 1000, 810);
    P.tryFire(Math.atan2(e.y - P.y, e.x - P.x));
    let glow = 0, sparks = 0, ember = 0, tracer = 0, impacts = 0, flash = 0;
    for (let i = 0; i < 30; i++) {
      window.__adv(1);
      for (const b of c.bolts) { if (b.glow) glow++; if (b.tail.visible) tracer++; }
      for (const f of c.flashes) { if (f.glow) glow++; if (f.img.visible) flash++; }
      for (const m of c.impacts) { impacts++; if (m.glow) glow++; if (m.g) sparks++; if (m.ember) ember++; }
    }
    P.fireCooldown = 0; P.x = 840; P.y = 620; P.body.reset(840, 620); P.tryFire(-Math.PI / 2);
    for (let i = 0; i < 30; i++) { window.__adv(1); for (const m of c.impacts) { impacts++; if (m.g) sparks++; if (m.ember) ember++; if (m.glow) glow++; } }
    window.__fxmod.setLowQuality(false);
    return { glow, sparks, ember, tracer, impacts, flash, heat: c.heatGlow.visible };
  });
  check('low quality: tracers, flashes and contacts still drawn; no scatter, glow or ember created', r.tracer > 0 && r.flash > 0 && r.impacts > 0 && r.glow === 0 && r.sparks === 0 && r.ember === 0, JSON.stringify(r));
  await p.close();
}

// ── 9. BUDGET ─────────────────────────────────────────────────────────────
if (on(9)) {
  console.log('\n== 9. budget');
  const p = await boot(B, { q: Q_SWARM });
  const r = await p.evaluate(() => {
    const gs = window.__gs, P = gs.player, c = gs._p2a;
    window.__headless = true;
    const fire = (n) => { for (let i = 0; i < n; i++) { if (i % 4 === 0) { P.fireCooldown = 0; P.ammo = 99; P.keyboardFire(); } window.__adv(1); } };
    fire(240);                                     // warm the pools
    const pools0 = c.imgPool.length + c.gfxPool.length + c.bolts.length * 3 + c.flashes.length * 2 + c.impacts.length * 4;
    const objs0 = gs.children.list.filter((o) => o.texture?.key?.startsWith?.('p2a-') || (o.type === 'Graphics' && c.gfxPool.includes(o))).length;
    fire(600);
    const objs1 = gs.children.list.filter((o) => o.texture?.key?.startsWith?.('p2a-') || (o.type === 'Graphics' && c.gfxPool.includes(o))).length;
    // forty contacts in one frame
    for (let i = 0; i < 40; i++) c._impact('body', 800 + i, 700, 0, {});
    const capped = c.impacts.length;
    window.__adv(30);
    window.__headless = false;
    return { objs0, objs1, capped, stats: c.stats, pools0 };
  });
  check(`sustained fire (840 ticks, ${r.stats.bolts} tracers): P2-A display objects created once and reused (${r.objs0} after warm-up, ${r.objs1} after 600 more ticks)`, r.objs1 <= r.objs0 + 6 && r.objs1 <= 80, JSON.stringify({ objs0: r.objs0, objs1: r.objs1 }));
  check('forty contacts in one frame: at most 14 live, the oldest recycled', r.capped === 14 && r.stats.recycled >= 26, JSON.stringify({ capped: r.capped, recycled: r.stats.recycled }));
  await p.close();
}

// ── 10. FROZEN FILES ──────────────────────────────────────────────────────
if (on(10)) {
  console.log('\n== 10. frozen files');
  const paths = ['src/entities', 'src/config.js', 'src/data', 'src/systems/pixelArt.js', 'src/systems/rosterPaint.js', 'src/systems/vpPaint.js', 'src/systems/vpHangar.js', 'src/systems/visualPilot.js',
    'src/systems/p1Paint.js', 'src/systems/p1Player.js', 'src/systems/p1Banner.js', 'src/systems/FX.js', 'src/systems/juice.js', 'src/systems/HUD.js', 'src/systems/bulwarkCurtain.js', 'src/systems/shieldContact.js',
    'src/systems/rosterWeaponFx.js', 'src/systems/gunnerMuzzle.js', 'src/systems/bulwarkSidearm.js', 'src/systems/CameraDirector.js', 'src/systems/EnvLight.js', 'src/systems/bulwarkStuck.js', 'src/systems/bulwarkAngle.js',
    'src/systems/marksmanStuck.js', 'src/systems/marksmanAngle.js', 'src/systems/firingSpot.js', 'src/systems/NavGrid.js', 'src/systems/controlLayout.js', 'src/systems/rng.js', 'src/main.js'];
  let diff = '';
  try { diff = execSync(`git diff --stat ${BASE_REV} -- ${paths.join(' ')}`, { encoding: 'utf8' }).trim(); } catch (e) { diff = `git failed: ${e.message}`; }
  check(`no change against ${BASE_REV} in entities (Bullet.js, Player.js, Enemy.js), config, data, the painters, P1, FX/juice, HUD, the Bulwark field, roster weapon FX, camera, light, AI seams, nav, rng`, diff === '', diff);
  let seam = '';
  try { seam = execSync(`git diff --stat ${BASE_REV} -- src/scenes/GameScene.js src/scenes/PreloadScene.js`, { encoding: 'utf8' }).trim(); } catch (e) { seam = e.message; }
  let gsDiff = '';
  try { gsDiff = execSync(`git diff -U0 ${BASE_REV} -- src/scenes/GameScene.js src/scenes/PreloadScene.js`, { encoding: 'utf8' }); } catch (e) { gsDiff = e.message; }
  const added = gsDiff.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++') && !/^\+\s*\/\//.test(l));
  const removed = gsDiff.split('\n').filter((l) => l.startsWith('-') && !l.startsWith('---'));
  check('GameScene / PreloadScene: only the two imports and the two install calls added, nothing removed', removed.length === 0 && added.length === 4 && added.every((l) => /installFxP2A|paintFxP2A/.test(l)), `${added.length} added, ${removed.length} removed: ${added.join(' | ')}`);
  const g = enemyJsGuard(process.cwd() + '/');
  check('Enemy.js guard (outside the Bomber, the Bomber-only veto)', g.outside && g.bomberOnlyVeto && g.vetoCode, g.detail);
}

// ── 11. AGAINST THE PREVIOUS BUILD ────────────────────────────────────────
if (OLD && !SELF && on(11)) {
  console.log(`\n== 11. against the previous build (${OLD})`);
  for (const [label, flags] of [['R1 (no flags)', ''], ['V2C', 'visualPilot=v2c'], ['P1', A]]) {
    const pOld = await boot(flags, { base: OLD }), pNew = await boot(flags);
    const tOld = await pOld.evaluate(() => window.__allTex()), tNew = await pNew.evaluate(() => window.__allTex());
    const dk = [...new Set([...Object.keys(tOld), ...Object.keys(tNew)])].filter((k) => tOld[k] !== tNew[k]);
    check(`${label}: every texture byte-identical to the previous build`, dk.length === 0, dk.join(' '));
    await pOld.close(); await pNew.close();
  }
  for (const [label, q, oldFlags, newFlags] of [['SWARM TIDE, R1', Q_SWARM, '', ''], ['SWARM TIDE, P1', Q_SWARM, A, A], ['SWARM TIDE, B vs the previous P1', Q_SWARM, A, B], ['CROSSFIRE, B vs the previous P1', Q_CROSS, A, B], ['SWARM TIDE, R1 + ignored fxPilot=p2a', Q_SWARM, '', 'fxPilot=p2a']]) {
    const a = await replay(oldFlags, q, { base: OLD }), b = await replay(newFlags, q);
    const d = firstDiff(a.hashes, b.hashes);
    check(`${label}: ${TICKS} ticks identical to the previous build`, d < 0, d < 0 ? `${a.draws} draws` : `first divergent tick ${d}`);
  }
} else if (!SELF && on(11)) console.log('\n== 11. skipped (no --old=URL)');

// ── 12. RESTART AND RELOAD KEEP THE MODE ──────────────────────────────────
if (!SELF && on(12)) {
  console.log('\n== 12. restart and reload keep the mode');
  for (const [M, flags, want] of [['B', B, true], ['A', A, false]]) {
    const p = await boot(flags);
    const after = await p.evaluate(() => {
      const gs = window.__gs;
      gs.scene.start('Game', { mode: 'endless', seed: 4242 });
      for (let i = 0; i < 600 && !(gs.roomSpec && gs.player?.active); i++) window.__adv(1);
      window.__adv(20);
      return { p2a: window.__dbg.isFxP2A(), inst: !!gs._p2a, p1: !!gs._p1Player };
    });
    check(`${M}: a scene restart keeps the mode (P2-A ${want ? 'installed' : 'absent'}, P1 installed)`, after.p2a === want && after.inst === want && after.p1, JSON.stringify(after));
    await p.reload();
    await p.waitForFunction(() => window.game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 60000 });
    const rl = await p.evaluate(async () => {
      const u = performance.getEntriesByType('resource').map((r) => r.name).find((n) => /systems\/debug\.js/.test(n));
      const d = await import(u);
      return { p2a: d.isFxP2A(), tex: window.game.textures.exists('p2a-tail-p') };
    });
    check(`${M}: a reload keeps the mode (and paints the p2a set only when on)`, rl.p2a === want && rl.tex === want, JSON.stringify(rl));
    await p.close();
  }
}

await browser.close();
const fails = results.filter((r) => !r.ok);
console.log(`\n${results.length - fails.length}/${results.length} passed${SELF ? '  (SELFTEST: sections 3, 5 and 6 are expected to FAIL)' : ''}`);
if (SELF) {
  const must = ['position, bearing, velocity', 'headless ticks, B identical', 'RENDERED ticks, B identical', 'draws no Math.random'];
  const ok = must.every((m) => fails.some((f) => f.name.includes(m)));
  console.log(ok ? 'SELFTEST OK: the checks caught the injected changes' : 'SELFTEST FAILED: a check did not catch an injected change');
  process.exit(ok ? 0 : 1);
}
process.exit(fails.length ? 1 : 0);
