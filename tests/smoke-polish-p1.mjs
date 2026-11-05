// SMOKE: P1 — COMBAT VISUAL POLISH (`?visualPilot=v2c&polish=p1`) — PRESENTATION
// ONLY, PROVEN AGAINST THE APPROVED V2C BASELINE.
// Standalone; needs `npm run dev` on :5173 and, for section 8, the PREVIOUS
// build — the V2C build `56b10d7` — on another port (`--old=URL`).
//
// A = `visualPilot=v2c` (approved, frozen), B = `visualPilot=v2c&polish=p1`.
// This asserts nothing about whether P1 looks better (the handset's job), only
// that it is what it claims to be:
//   0  THE FLAG: honoured only as `polish=p1` + `visualPilot=v2c`; every other
//      combination (no pilot, v2, v2b, other values) is that mode exactly; it
//      moves none of the gameplay switches or the pilot
//   1  TEXTURES: B paints every A texture byte-identically and adds exactly the
//      five `p1-*` keys; an ignored `polish=p1` adds nothing to R1, V2 or V2B
//   2  INSTALL: B replaces exactly four HUD instance methods and adds exactly
//      one POST_UPDATE, one `player-fire-super` and one shutdown listener; every HUD-bound
//      game event and every HUD input listener is A's; A has none of it
//   3  BANNERS: every announcement string the game emits, run through the REAL
//      tweens tick by tick, stays inside the canvas with the 24px margin at its
//      widest animated box (scale + stroke) and clear of the pause button, at
//      720x1280 and on a narrow 360x780 portrait viewport; the RENDERED INK of
//      the worst strings (pixel diff, banner on vs off) stays inside too; the
//      wording is the emitted wording; the alpha timeline is A's; the same
//      check run on A FAILS (it catches the shipped clipping); two-line
//      banners keep the shipped top edge; under a duel the banner clears the
//      duel block; a same-frame combo or medal never overlaps a live banner;
//      the sector sign's slam stays on the canvas and its directive in its plate
//   4  THE SUPER-READY INDICATOR: the state cycle (none -> charging -> ready ->
//      fired -> spent), the ping, rotation, suppression, bush and death states;
//      the red aura is never drawn under P1; nothing is redrawn or allocated per
//      frame; restart and quit-to-title leave no P1 object or listener behind
//   5  WEAPONS: the texture per state (pistol, rifle, blade mid-combo, `-hot`
//      while ready), the blade's shipped pivot, flip and depth rules, the bore
//      on the aim ray, the muzzle at the bolt; the shipped overlay hidden; and
//      every bolt (pistol, rifle, Super) spawns where A spawns it
//   6  SAME FIGHT: seeded replays — every tick's player / camera / enemy /
//      bullet state and Math.random draw count — A vs B, with pistol, rifle,
//      Supers and melee combos: SWARM TIDE (production and legacy baselines)
//      and BOMBER RUN, headless and rendered; and each ignored `polish=p1` mode
//      vs its own mode
//   7  FROZEN FILES: no change against `56b10d7` in entities, config, data,
//      `pixelArt.js`, `rosterPaint.js`, the V2/V2B/V2C painters and seams, the
//      camera, light, AI seams or nav; the Enemy.js guard holds
//   8  AGAINST THE PREVIOUS BUILD (`--old`, the V2C build): R1, V2, V2B and V2C
//      textures and fights are that build's; B's fight is that build's V2C fight
//   9  restart and reload keep the mode
// `--selftest` injects, in B only, a Math.random draw in the P1 hook, a 1px
// shift of the pistol bolt, and the shipped (unfitted) banner: sections 3, 5
// and 6 must FAIL.
//
// usage: node tests/smoke-polish-p1.mjs [--old=URL] [--selftest] [--ticks=N]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { CHROME, bootPage, FIGHT_SEG } from './diag-stuck-audit.mjs';
import { enemyJsGuard } from './enemy-frozen.mjs';

const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const SELF = process.argv.includes('--selftest');
const OLD = opt('old', null);
const NOW = 'http://localhost:5173/';
const TICKS = +opt('ticks', '1500');
const BASE_REV = '56b10d7';
const A = 'visualPilot=v2c', B = 'visualPilot=v2c&polish=p1';
const Q_SWARM = 'encdbg=swarmTide&room=hangar&sector=3';
const Q_BOMB = 'encdbg=bomberRun&room=hangar&sector=4';
const P1_KEYS = ['p1-blade', 'p1-pistol', 'p1-pistol-hot', 'p1-rifle', 'p1-rifle-hot'];
const TMP = mkdtempSync(`${tmpdir()}/p1smoke-`);
const ONLY = opt('only', '') ? new Set(opt('only', '').split(',').map(Number)) : null;   // dev: run some sections
const on = (n) => !ONLY || ONLY.has(n);

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`); };
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const isB = (flags) => /polish=p1/.test(flags) && /visualPilot=v2c/.test(flags);

// ── in-page instruments ───────────────────────────────────────────────────
async function instrument(p, flags) {
  await p.evaluate(async ({ self, b }) => {
    const gs = window.__gs;
    const fnv = (str) => { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0; return h; };
    window.__dbg = await window.__mod(/systems\/debug\.js/);
    window.__hud = window.game.scene.getScene('HUD');
    if (self && b) {
      // what a careless P1 would do — injected in B only
      const c = gs._p1Player; const u = c.update.bind(c); c.update = (t, d) => { Math.random(); u(t, d); };
      const fp = gs.firePlayerPrimary.bind(gs);
      gs.firePlayerPrimary = (a) => { const x = gs.player.x; gs.player.x += 1; fp(a); gs.player.x = x; };
      delete window.__hud.showBanner;
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
    // px from an overlay's origin to its muzzle face along +x: the rightmost
    // texture column holding a pixel that is neither empty nor the outline
    window.__muzzle = (img) => {
      const src = img.texture.getSourceImage();
      const cv = document.createElement('canvas'); cv.width = src.width; cv.height = src.height;
      const c2 = cv.getContext('2d'); c2.drawImage(src, 0, 0);
      const d = c2.getImageData(0, 0, cv.width, cv.height).data;
      let right = 0;
      for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
        const i = (y * cv.width + x) * 4;
        if (d[i + 3] > 0 && !(d[i] === 6 && d[i + 1] === 7 && d[i + 2] === 10)) right = Math.max(right, x + 1);
      }
      return right - img.originX * img.width;
    };
    window.__clearArena = () => {
      gs.arenaActive = false; gs._spawnQueue = [];
      gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
      gs._roomModifier = null;
    };
    // A seeded replay folding the gameplay state of every tick into one hash.
    window.__trace = ({ seed, ticks, seg, headless, melee, rifleAt, superAt }) => {
      const P = gs.player, K = gs.keys, cam = gs.cameras.main;
      window.__headless = headless;
      window.__seed(seed); window.__draws = 0;
      const hashes = [];
      const f = (v) => (Math.round(v * 1000) / 1000).toString();
      for (let i = 0; i < ticks; i++) {
        const cur = seg.find(([a, bb]) => i >= a && i < bb)[2];
        K.A.isDown = cur.includes('A'); K.D.isDown = cur.includes('D'); K.W.isDown = cur.includes('W'); K.S.isDown = cur.includes('S');
        if (i >= 60 && i % 7 === 0) P.keyboardFire();
        if (superAt.includes(i)) { P.superCharge = 999; P.tryFireSuper(P._autoAimAngle()); }
        if (superAt.map((s) => s - 120).includes(i)) P.superCharge = 999;            // a ready Super carried for 2s
        if (melee.includes(i)) { P.meleeCharge = 99; P.tryMeleeCombo(); }
        if (i === rifleAt) { P.secondary = 'rifle'; P.secondaryAmmo = 90; gs.events.emit('secondary-equipped', 'rifle'); }
        window.__adv(1);
        let s = `${i}|${f(P.x)},${f(P.y)},${P.hp},${f(P.body.center.x)},${f(P.body.center.y)},${P.superCharge},${P.meleeCharge}|${f(cam.scrollX)},${f(cam.scrollY)}|`;
        for (const e of gs.enemies.getChildren()) if (e.active) s += `${e.enemyType}:${f(e.x)},${f(e.y)},${Math.round(e.hp)},${f(e.body.center.x)},${f(e.body.center.y)};`;
        for (const g of [...gs.hostileBullets, gs.playerBullets, gs.playerRifleBullets, gs.playerSuperBullets]) {
          for (const bb of g?.getChildren?.() || []) if (bb.active) s += `b${f(bb.x)},${f(bb.y)};`;
        }
        s += `|d${window.__draws}`;
        hashes.push(fnv(s));
      }
      const K2 = gs.keys; K2.A.isDown = K2.D.isDown = K2.W.isDown = K2.S.isDown = false;
      return { hashes, draws: window.__draws, spawned: gs.enemies.getChildren().length };
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
  const cases = [['', false, null], ['polish=p1', false, null], ['visualPilot=v2&polish=p1', false, 'v2'], ['visualPilot=v2b&polish=p1', false, 'v2b'],
    [A, false, 'v2c'], [B, true, 'v2c'], ['visualPilot=v2c&polish=P1', false, 'v2c'], ['visualPilot=v2c&polish=1', false, 'v2c'], ['visualPilot=v2c&polish=p2', false, 'v2c'],
    [`baseline=legacy&${B}`, true, 'v2c']];
  const sw = {};
  for (const [flags, want, vp] of cases) {
    const p = await boot(flags);
    const r = await p.evaluate(() => {
      const d = window.__dbg, gs = window.__gs;
      return { p1: d.isPolishP1(), vp: d.getVisualPilot(), base: d.getGameplayBaseline(), inst: !!gs._p1Player, hud: Object.prototype.hasOwnProperty.call(window.__hud, 'showBanner'),
        sw: [d.isRosterV1(), d.isMoveV22(), d.isGaitV2(), d.getBulwarkStuck(), d.getMarksmanStuck(), d.isMarksmanAngle(), d.isBulwarkAngle()].join(',') };
    });
    check(`?${flags || '(no flags)'} -> P1 ${want ? 'ON' : 'off'}, pilot ${vp}`, r.p1 === want && r.vp === vp && r.inst === want && r.hud === want, JSON.stringify({ p1: r.p1, vp: r.vp, installed: r.inst, hud: r.hud }));
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
  check(`B: every A texture byte-identical (${Object.keys(tA).length}: hero, swarm, V2B set, roster, weapons, FX)`, changed.length === 0, changed.join(' '));
  check('B: the added textures are exactly the five p1-* keys', JSON.stringify(added) === JSON.stringify(P1_KEYS), added.join(' '));
  check('B: the shipped wpn-pistol / wpn-rifle / wpn-blade still painted, unchanged', ['wpn-pistol', 'wpn-rifle', 'wpn-blade'].every((k) => tB[k] && tB[k] === tA[k]));
  for (const [label, base] of [['R1', ''], ['V2', 'visualPilot=v2'], ['V2B', 'visualPilot=v2b']]) {
    const t0 = await tex(base), t1 = await tex([base, 'polish=p1'].filter(Boolean).join('&'));
    const keys = [...new Set([...Object.keys(t0), ...Object.keys(t1)])];
    const d = keys.filter((k) => t0[k] !== t1[k]);
    check(`${label} + ignored polish=p1: every texture byte-identical to ${label}, no p1 key`, d.length === 0 && !Object.keys(t1).some((k) => k.startsWith('p1-')), d.join(' '));
  }
}

// ── 2. INSTALL ────────────────────────────────────────────────────────────
const listeners = (p) => p.evaluate(() => {
  const gs = window.__gs, hud = window.__hud, ev = gs.events;
  const out = {};
  for (const n of ev.eventNames()) out[String(n)] = ev.listenerCount(n);
  const inp = {}; for (const n of hud.input.eventNames()) inp[String(n)] = hud.input.listenerCount(n);
  const own = ['showBanner', '_renderMedal', 'showCombo', 'showSectorSign'].filter((k) => Object.prototype.hasOwnProperty.call(hud, k));
  return { game: out, input: inp, own, ws: gs.player.weaponSprite.visible, inst: !!gs._p1Player };
});
if (on(2)) {
  console.log('\n== 2. install');
  const pA = await boot(A), pB = await boot(B);
  const lA = await listeners(pA), lB = await listeners(pB);
  check('B replaces exactly the four HUD layout methods on the instance; A none', JSON.stringify(lB.own) === JSON.stringify(['showBanner', '_renderMedal', 'showCombo', 'showSectorSign']) && lA.own.length === 0, `${lA.own} / ${lB.own}`);
  const ev = [...new Set([...Object.keys(lA.game), ...Object.keys(lB.game)])];
  const diff = ev.filter((k) => (lA.game[k] || 0) !== (lB.game[k] || 0)).map((k) => `${k}:${lA.game[k] || 0}->${lB.game[k] || 0}`);
  const want = ['postupdate', 'player-fire-super', 'shutdown'];
  check('B adds exactly one POST_UPDATE, one player-fire-super and one shutdown (its own cleanup) listener; every other game event (HUD delivery included) as A', diff.length === 3 && want.every((k) => (lB.game[k] || 0) === (lA.game[k] || 0) + 1), diff.join(' '));
  check('HUD touch input listeners identical', JSON.stringify(lA.input) === JSON.stringify(lB.input), JSON.stringify(lB.input));
  check('B: the shipped weapon overlay is hidden and the P1 layer installed; A: shown, not installed', !lB.ws && lB.inst && lA.ws && !lA.inst);
  await pA.close(); await pB.close();
}

// ── 3. BANNERS ────────────────────────────────────────────────────────────
// Every literal `show-banner` string in the source, and the dynamic ones at
// their widest realistic values.
// every quoted string inside each `'show-banner', ...)` call — ternaries and
// continuation lines included — minus colours
const literal = (() => {
  const files = execSync('grep -rl "show-banner" src', { encoding: 'utf8' }).trim().split('\n');
  const out = new Set();
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    const re = /'show-banner',([\s\S]*?)\)\s*[;,)]/g;
    let m;
    while ((m = re.exec(src))) for (const q of m[1].matchAll(/'([^'\n]+)'/g)) if (!q[1].startsWith('#')) out.add(q[1]);
  }
  return [...out].sort();
})();
const STRINGS = [...new Set([...literal, 'SECTOR 1', 'SECTOR 88', 'SECTOR 10 — DARK LORD', 'SECTOR 100 — DARK LORD', 'WAVE 1', 'WAVE 12', 'VADER — WOUND 3',
  'VADER APPROACHES', 'ENRAGED!', 'FRENZY', 'ELITE GUARD', 'DARKNESS', 'CLUSTER: TAKE ONE', 'RIFLE: TAKE ONE', 'NO MOVE "SWEEPINGBARRAGE"',
  'VOSK THE UNBROKEN', 'KRAYT-HOUND OF THE SEVENTH VEIL', 'SWEEPING BARRAGE', 'SUPPRESSING WALL', 'CHAIN DETONATION', 'SLIDE & SMASH', 'PLANT & SNIPE'])];
const SAFE = { margin: 24, w: 720 };
async function bannerSweep(p, { duel = false } = {}) {
  return p.evaluate(({ strings, duel }) => {
    const gs = window.__gs, hud = window.__hud;
    window.__clearArena();
    window.__headless = true;           // tweens and bounds need no renderer
    // the room's own scheduled banners (WAVE, the modifier at 1.55s, the
    // terminal hint at up to 3.1s) must have fired AND finished their exit
    // (3.1s + 1.57s): a hint still fading when the sweep starts is exactly the
    // shipped stale-tween behaviour P1 changes, and A and B would differ by design
    window.__adv(360);
    let foe = null;
    if (duel) { foe = gs.spawnEnemyAt('shooter', 980, 900, {}); foe._miniBoss = true; foe._nemesis = { name: 'Vosk', tint: '#ffb020' }; hud.startDuel(foe); window.__adv(2); }
    const pb = hud._pauseBtn;
    const out = [];
    for (const s of strings) {
      hud.showBanner(s, '#ffffff');
      let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, hitPause = false;
      const alphas = [];
      for (let i = 0; i < 100; i++) {
        window.__adv(1);
        const b = hud.banner; alphas.push(Math.round(b.alpha * 100));
        if (b.alpha <= 0.001) continue;
        const r = b.getBounds();
        minX = Math.min(minX, r.x); maxX = Math.max(maxX, r.right); minY = Math.min(minY, r.y); maxY = Math.max(maxY, r.bottom);
        // the pause disc against the box (closest point)
        const cx = Math.max(r.x, Math.min(pb.x, r.right)), cy = Math.max(r.y, Math.min(pb.y, r.bottom));
        if (Math.hypot(cx - pb.x, cy - pb.y) < pb.r) hitPause = true;
      }
      out.push({ s, text: hud.banner.text, minX, maxX, minY, maxY, hitPause, lines: hud.banner.text.split('\n').length, alphas: alphas.join(',') });
      window.__adv(5);
    }
    if (foe) { hud.endDuel(); gs._destroyEnemyFully(foe); }
    window.__headless = false;
    return out;
  }, { strings: STRINGS, duel });
}
if (on(3)) {
  console.log('\n== 3. banners');
  const pA = await boot(A), pB = await boot(B);
  const rA = await bannerSweep(pA), rB = await bannerSweep(pB);
  const bad = rB.filter((r) => r.minX < SAFE.margin || r.maxX > SAFE.w - SAFE.margin);
  check(`B: every one of ${STRINGS.length} banner strings stays >= ${SAFE.margin}px inside the canvas at its widest animated box (real tweens, scale + stroke)`,
    bad.length === 0 && rB.length === STRINGS.length, bad.slice(0, 4).map((r) => `${r.s} ${Math.round(r.minX)}..${Math.round(r.maxX)}`).join('; '));
  const pz = rB.filter((r) => r.hitPause);
  check('B: no banner box ever crosses the pause button', pz.length === 0, pz.map((r) => r.s).join('; '));
  const badA = rA.filter((r) => r.minX < SAFE.margin || r.maxX > SAFE.w - SAFE.margin || r.hitPause);
  const clippedA = rA.filter((r) => r.minX < 0 || r.maxX > SAFE.w);
  check(`CONTROL: the same check FAILS on A (the shipped banner): ${clippedA.length} strings drawn past the canvas, ${badA.length} past the margin or under the pause button`,
    clippedA.length >= 3, clippedA.slice(0, 5).map((r) => r.s).join('; '));
  const word = rB.filter((r) => r.text.replace(/\n/g, ' ') !== r.s);
  check('B: every banner says exactly what was emitted (a line break is the only change)', word.length === 0, word.map((r) => `${r.s} -> ${r.text}`).join('; '));
  const tl = rB.filter((r, i) => r.alphas !== rA[i].alphas);
  check('B: every banner\'s alpha timeline (fade in 220ms, hold 700ms, fade 650ms) is A\'s, tick for tick', tl.length === 0, tl.map((r) => r.s).slice(0, 3).join('; '));
  const top = rB.filter((r) => r.minY < 84 + 18 - 0.5);
  check('B: no banner (one or two lines) rises above the shipped one-line top edge (bar + 18)', top.length === 0, top.map((r) => `${r.s} ${Math.round(r.minY)}`).join('; '));
  check(`B: long strings are composed on two lines (${rB.filter((r) => r.lines === 2).length}), short ones stay on one`, rB.filter((r) => r.s.length <= 10).every((r) => r.lines === 1) && rB.some((r) => r.lines === 2));
  const dB = await bannerSweep(pB, { duel: true });
  const duelBad = dB.filter((r) => r.minY < 84 + 55 + 6 - 0.5 || r.minX < SAFE.margin || r.maxX > SAFE.w - SAFE.margin);
  check('B under a duel: every banner clears the duel block (bar + 61) and the canvas margin', duelBad.length === 0, duelBad.slice(0, 3).map((r) => `${r.s} y${Math.round(r.minY)}`).join('; '));

  // lanes: same-frame banner + combo / medal; the sign
  const lanes = async (p) => p.evaluate(() => {
    const gs = window.__gs, hud = window.__hud;
    const box = (o, s) => { const r = o.getBounds(); return [r.x, r.y, r.right, r.bottom]; };
    const ov = (a, b) => a && b && a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
    const res = {};
    const pair = (name, fire, other) => {
      fire();
      let worst = false;
      for (let i = 0; i < 70; i++) {
        window.__adv(1);
        const b = hud.banner, o = other();
        if (b.alpha > 0.05 && o?.alpha > 0.05 && ov(box(b), box(o))) worst = true;
      }
      res[name] = worst;
      window.__adv(60);
    };
    window.__clearArena();
    window.__headless = true;
    window.__adv(360);
    pair('MULTIKILL + x12', () => { hud.showBanner('MULTIKILL', '#ff8020'); hud.showCombo(12); }, () => hud.comboText);
    pair('SLICE TERMINALS FOR SUPPORT + x7', () => { hud.showBanner('SLICE TERMINALS FOR SUPPORT', '#ffd040'); hud.showCombo(7); }, () => hud.comboText);
    pair('ARENA SURVIVED — FINISH THEM! + medal', () => { hud.showBanner('ARENA SURVIVED — FINISH THEM!', '#20ff60'); hud.showMedal('ARENA CLEAR', 2500, '#20ff60'); }, () => hud._medalText);
    // the sign: a real open door; its slam box and its directive
    gs.sector = 7; gs.runKills = 143; gs._roomKillsAtStart = 0; gs._openDoor();
    let slam = [1e9, -1e9];
    for (let i = 0; i < 30; i++) { window.__adv(1); if (hud.sectorSign.visible && hud.sectorSign.alpha > 0) { const r = hud.sectorSign.getBounds(); slam = [Math.min(slam[0], r.x), Math.max(slam[1], r.right)]; } }
    res.signShown = hud._signShown;
    res.slam = slam;
    res.directive = hud.signMain.width; res.plate = 720 - 56 - 40;
    pair('sign + MULTIKILL + x5', () => { hud.showBanner('MULTIKILL', '#ff8020'); hud.showCombo(5); }, () => hud.comboText);
    hud.showBanner('MULTIKILL', '#ff8020'); window.__adv(16);
    const sb = hud.sectorSign.getBounds(), bb = hud.banner.getBounds();
    res.bannerBelowSign = bb.y >= sb.bottom - 0.5;
    gs.doorZone?.destroy(); gs.doorZone = null; window.__adv(2);
    window.__headless = false;
    return res;
  });
  const LA = await lanes(pA), LB = await lanes(pB);
  for (const k of ['MULTIKILL + x12', 'SLICE TERMINALS FOR SUPPORT + x7', 'ARENA SURVIVED — FINISH THEM! + medal', 'sign + MULTIKILL + x5']) {
    check(`B: ${k} fired in the same frame never overlap (A: ${LA[k] ? 'overlaps' : 'clear'})`, LB[k] === false);
  }
  check(`B: the sector sign's arrival slam stays on the canvas (${Math.round(LB.slam[0])}..${Math.round(LB.slam[1])}; A ${Math.round(LA.slam[0])}..${Math.round(LA.slam[1])})`, LB.signShown && LB.slam[0] >= 0 && LB.slam[1] <= 720 && (LA.slam[0] < 0 || LA.slam[1] > 720));
  check(`B: the sign's directive fits inside its plate (${Math.round(LB.directive)} <= ${LB.plate}; A ${Math.round(LA.directive)})`, LB.directive <= LB.plate && LA.directive > LB.plate);
  check('B: a banner raised while the sign is up sits below it (A: drawn behind the plate)', LB.bannerBelowSign && !LA.bannerBelowSign);

  // RENDERED INK, at the forced peak (scale 1.16, full alpha), banner on vs off
  const inkStrings = ['SUPPORT: SHIELD CHARGED & BACTA VIAL', 'ARENA SURVIVED — FINISH THEM!', 'SLICE TERMINALS FOR SUPPORT', 'CHAMBER CLEAR', 'SURGE INCOMING', '⚠ DETECTED', 'KRAYT-HOUND OF THE SEVENTH VEIL'];
  const ink = async (p, tag, vp) => {
    const out = [];
    await p.evaluate(() => { window.__clearArena(); window.__headless = true; window.__adv(360); window.__headless = false; });
    for (const s of inkStrings) {
      const rect = await p.evaluate((s) => {
        const gs = window.__gs, hud = window.__hud;
        window.__clearArena(); hud.showBanner(s, '#ffffff'); window.__adv(16);
        hud.tweens.killTweensOf(hud.banner);
        gs.scene.pause(); hud.scene.pause();
        hud.banner.setScale(1.16).setAlpha(1); window.__adv(1);
        const c = window.game.canvas.getBoundingClientRect();
        return { x: c.x, y: c.y, w: c.width, h: c.height };
      }, s);
      const k = rect.w / 720;
      const clip = { x: Math.max(0, rect.x - 8), y: rect.y + 84 * k, width: Math.min(vp.width, rect.w + 16), height: 220 * k };
      const f1 = `${TMP}/${tag}-on.png`, f0 = `${TMP}/${tag}-off.png`;
      await p.screenshot({ path: f1, clip });
      await p.evaluate(() => { window.__hud.banner.setAlpha(0); window.__adv(1); });
      await p.screenshot({ path: f0, clip });
      await p.evaluate(() => { const gs = window.__gs, hud = window.__hud; gs.scene.resume(); hud.scene.resume(); window.__adv(2); });
      const r = execSync(`python3 -I -c "
from PIL import Image, ImageChops
a=Image.open('${f1}').convert('RGB'); b=Image.open('${f0}').convert('RGB')
d=ImageChops.difference(a,b).convert('L').point(lambda v: 255 if v>24 else 0)
bb=d.getbbox(); print(bb if bb else '')"`, { encoding: 'utf8' }).trim();
      const m = r.match(/\((\d+), (\d+), (\d+), (\d+)\)/);
      // ink columns in canvas px
      const x0 = m ? (+m[1] + clip.x - rect.x) / k : NaN, x1 = m ? (+m[3] + clip.x - rect.x) / k : NaN;
      out.push({ s, x0, x1 });
    }
    return out;
  };
  for (const [tag, vp] of [['720x1280', { width: 720, height: 1280 }], ['360x780', { width: 360, height: 780 }]]) {
    const p = vp.width === 720 ? pB : await boot(B, { viewport: vp });
    const r = await ink(p, `b${tag}`, vp);
    const off = r.filter((x) => !(x.x0 >= 16 && x.x1 <= 704));
    check(`B ${tag}: the RENDERED ink of the ${r.length} widest strings at the forced peak stays >= 16px inside the canvas`, off.length === 0 && r.every((x) => !Number.isNaN(x.x0)),
      r.map((x) => `${x.s.slice(0, 12)} ${Math.round(x.x0)}..${Math.round(x.x1)}`).join('; '));
    if (vp.width !== 720) await p.close();
  }
  {
    const r = await ink(pA, 'a720', { width: 720, height: 1280 });
    const cut = r.filter((x) => x.x0 < 4 || x.x1 > 716);
    check(`CONTROL: the ink check FAILS on A (${cut.length} of ${r.length} strings inked to the canvas edge)`, cut.length >= 3, cut.map((x) => x.s.slice(0, 14)).join('; '));
  }
  await pA.close(); await pB.close();
}

// ── 4. THE SUPER-READY INDICATOR ──────────────────────────────────────────
if (on(4)) {
console.log('\n== 4. the Super-ready indicator');
  const p = await boot(B);
  const r = await p.evaluate(() => {
    const gs = window.__gs, P = gs.player, c = gs._p1Player;
    window.__clearArena();
    const out = {};
    const vis = () => ({ gauge: c.gauge.visible, ring: c.ring.visible, ticks: c.ticks.visible, ping: c.ping.visible, aura: P.superAura.visible, w: c.weapon.texture.key });
    let redraws = 0; const dg = c._drawGauge.bind(c); c._drawGauge = (t) => { redraws++; dg(t); };
    P.superCharge = 0; window.__adv(5); out.none = vis();
    P.superCharge = 2; window.__adv(2); out.charging = vis();
    redraws = 0; window.__adv(60); out.chargeRedraws = redraws;
    let auraSeen = false;
    P.superCharge = 4; window.__adv(1); out.readyFirst = vis();
    const r0 = c.ring.rotation; const n0 = gs.children.list.length; const cmd0 = c.ring.commandBuffer.length + c.ticks.commandBuffer.length;
    for (let i = 0; i < 60; i++) { window.__adv(1); auraSeen ||= P.superAura.visible; }
    out.ready = vis(); out.rotated = Math.abs(c.ring.rotation - r0) > 0.1; out.listGrowth = gs.children.list.length - n0;
    out.cmdGrowth = c.ring.commandBuffer.length + c.ticks.commandBuffer.length - cmd0;
    const scales = []; for (let i = 0; i < 70; i++) { window.__adv(1); scales.push(c.ticks.scaleX); }
    out.beat = Math.max(...scales) > 1.1 && Math.min(...scales) < 1.02;
    // suppression with a full meter: dim and still
    P._suppressedMs = 3000; window.__adv(2); const rs = c.ring.rotation; window.__adv(20);
    out.suppressed = { ring: c.ring.visible, alpha: c.ring.alpha, still: c.ring.rotation === rs, w: c.weapon.texture.key };
    P._suppressedMs = 0; window.__adv(2);
    // the bush
    // the BushSystem rewrites hiddenInBush every frame: stand him in a bush by
    // answering its own question, then put the answer back
    const bs = gs.bushSystem, inside = bs.isInsideBush.bind(bs);
    bs.isInsideBush = (x, y, r) => (x === P.x && y === P.y) || inside(x, y, r);
    window.__adv(2); out.bushIn = P.hiddenInBush; out.bushA = c.ring.alpha; out.bushW = c.weapon.alpha;
    bs.isInsideBush = inside; window.__adv(2);
    // fire it
    P.aiming = true; P.aim = 0; const fired = P.tryFireSuper(0);
    let peak = 0; for (let i = 0; i < 6; i++) { window.__adv(1); peak = Math.max(peak, c.ring.scaleX); }
    out.firing = { fired, ...vis(), scale: peak };
    window.__adv(20); out.spent = { ...vis(), charge: P.superCharge };
    // death
    P.superCharge = 4; window.__adv(5); P.die(); window.__adv(2); out.dead = { ...vis(), wA: c.weapon.alpha };
    P.alive = true; P.hp = P.hpMax; window.__adv(2);
    out.auraSeen = auraSeen;
    return out;
  });
  check('not ready: nothing drawn, the red aura not drawn', !r.none.gauge && !r.none.ring && !r.none.aura, JSON.stringify(r.none));
  check('charging: the segmented gauge only; no ring, no red aura', r.charging.gauge && !r.charging.ring && !r.charging.aura, JSON.stringify(r.charging));
  check('charging: the gauge is not redrawn while the meter holds (60 ticks)', r.chargeRedraws === 0, `${r.chargeRedraws} redraws`);
  check('ready: ring + pawls + the one-shot ping, the weapon goes -hot, no red aura', r.readyFirst.ring && r.readyFirst.ticks && r.readyFirst.ping && !r.readyFirst.aura && /-hot$/.test(r.readyFirst.w), JSON.stringify(r.readyFirst));
  check('ready: the ping is gone after its 320ms, the ring turns, the pawls beat', !r.ready.ping && r.rotated && r.beat);
  check('ready: no display object added and no graphics command rebuilt over 60 ticks', r.listGrowth === 0 && r.cmdGrowth === 0, `+${r.listGrowth} objects, +${r.cmdGrowth} commands`);
  check('the shipped red aura is never drawn under P1 (60 ready ticks)', !r.auraSeen);
  check('suppressed with a full meter: the ring stays, dim and still; the weapon is not -hot', r.suppressed.ring && r.suppressed.alpha <= 0.35 && r.suppressed.still && !/-hot$/.test(r.suppressed.w), JSON.stringify(r.suppressed));
  check('in a bush: the ring at 0.3 of its alpha and the weapon at the shipped PLAYER.bushAlpha', r.bushIn && r.bushA <= 0.3 + 1e-6 && r.bushW < 1, `in ${r.bushIn}, ring ${r.bushA}, weapon ${r.bushW}`);
  check('Super fired: the ring snaps outward on release (peak scale over 6 ticks)', r.firing.fired && r.firing.scale > 1.1, JSON.stringify(r.firing));
  check('spent: meter 0, nothing drawn, the weapon back to plain', r.spent.charge === 0 && !r.spent.ring && !r.spent.ticks && !r.spent.gauge && !/-hot$/.test(r.spent.w), JSON.stringify(r.spent));
  check('dead (inside the ready ping): indicator and ping hidden, weapon alpha 0', !r.dead.ring && !r.dead.gauge && !r.dead.ping && r.dead.wA === 0, JSON.stringify(r.dead));
  // restart / quit to title: no P1 object or listener survives
  const lk = await p.evaluate(() => {
    const g = window.game;
    const sample = () => {
      const gs = g.scene.getScene('Game');
      const c = gs._p1Player, L = gs.children.list;
      const mine = c ? [c.weapon, c.gauge, c.ring, c.ticks, c.ping].filter((o) => L.includes(o)).length : 0;
      const p1Images = L.filter((o) => o.texture?.key?.startsWith?.('p1-')).length;
      return { mine, p1Images, post: gs.events.listenerCount('postupdate'), sup: gs.events.listenerCount('player-fire-super'), inst: !!c };
    };
    const wait = () => { const gs = g.scene.getScene('Game'); for (let i = 0; i < 600 && !(gs.roomSpec && gs.player?.active && gs._p1Player); i++) window.__adv(1); window.__adv(360); };
    const out = [];
    let old = g.scene.getScene('Game')._p1Player;
    for (let k = 0; k < 3; k++) {
      const gs = g.scene.getScene('Game');
      gs.player.superCharge = 4; window.__adv(10);
      gs.scene.start('Game', { mode: 'endless', seed: 4242 }); wait();
      const s = sample(); s.oldDead = !old.weapon && !old.ring; old = g.scene.getScene('Game')._p1Player; out.push(s);
    }
    // quit to title and back
    g.scene.getScene('Game').scene.stop('HUD'); g.scene.getScene('Game').scene.start('Title'); window.__adv(10);
    g.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 4242 }); wait();
    const t = sample(); t.oldDead = !old.weapon && !old.ring; out.push(t);
    return out;
  });
  const same = lk.every((s) => s.mine === 5 && s.p1Images === 1 && s.post === lk[0].post && s.sup === lk[0].sup && s.inst && s.oldDead);
  check('3 restarts + quit-to-title: the old P1 objects destroyed, exactly one fresh set of 5 in the display list, listener counts steady', same, JSON.stringify(lk.map((s) => [s.mine, s.p1Images, s.post, s.sup, s.oldDead])));
  await p.close();
}

// ── 5. WEAPONS ────────────────────────────────────────────────────────────
if (on(5)) {
console.log('\n== 5. weapons');
  const pB = await boot(B);
  const r = await pB.evaluate(() => {
    const gs = window.__gs, P = gs.player, c = gs._p1Player, w = c.weapon;
    window.__clearArena();
    const st = (o) => {
      P.aiming = true; P.aim = o.aim; P.secondary = o.rifle ? 'rifle' : null; if (o.rifle) P.secondaryAmmo = 30;
      P.superCharge = o.ready ? 4 : 0; P._meleeAnimT = 0; P._meleeAnimStage = 0; window.__adv(3);
      if (o.melee) { P._meleeAnimDur = 300; P._meleeAnimT = 150; P._meleeAnimStage = 1; window.__adv(1); }
      // the bore line: perpendicular distance of the weapon origin from the aim ray
      const dx = w.x - P.x, dy = w.y - P.y;
      const perp = Math.abs(dx * Math.sin(o.aim) - dy * Math.cos(o.aim));
      // the muzzle FACE: the rightmost painted column that is not outline
      const tip = window.__muzzle(w) + Math.hypot(w.x - P.x, w.y - P.y) * Math.sign(Math.cos(w.rotation - o.aim));
      return { key: w.texture.key, ox: +w.originX.toFixed(3), flip: w.flipY, behind: w.depth < P.depth, perp: +perp.toFixed(3), tip: +tip.toFixed(1), legacy: P.weaponSprite.visible };
    };
    const D = Math.PI / 180;
    // the shipped overlay, measured the same way, for the comparison
    P.aiming = true; P.aim = 0; P.secondary = null; P.superCharge = 0; window.__adv(3);
    const ws = P.weaponSprite;
    const legacyPistol = window.__muzzle(ws) + Math.hypot(ws.x - P.x, ws.y - P.y);
    P.secondary = 'rifle'; P.secondaryAmmo = 30; window.__adv(3);
    const legacyRifle = window.__muzzle(ws) + Math.hypot(ws.x - P.x, ws.y - P.y);
    return {
      legacyPistol, legacyRifle,
      east: st({ aim: 0 }), west: st({ aim: 180 * D }), north: st({ aim: -90 * D }), south: st({ aim: 90 * D }), ne: st({ aim: -40 * D }),
      rifle: st({ aim: 0, rifle: 1 }), rifleW: st({ aim: 170 * D, rifle: 1 }), hot: st({ aim: 0, ready: 1 }), rifleHot: st({ aim: 0, rifle: 1, ready: 1 }),
      blade: st({ aim: 0, melee: 1 }),
    };
  });
  check('pistol: p1-pistol, bore on the aim ray, the shipped overlay hidden', r.east.key === 'p1-pistol' && r.east.perp < 0.01 && !r.east.legacy, JSON.stringify(r.east));
  check('flip and depth are the shipped rules: west flipY, north behind the body, east / south / NE in front', r.west.flip && !r.east.flip && r.north.behind && !r.east.behind && !r.south.behind && !r.ne.behind);
  check('every pose keeps the bore on the aim ray (perpendicular < 0.01px)', [r.east, r.west, r.north, r.south, r.ne, r.rifle, r.rifleW].every((x) => x.perp < 0.01));
  check(`the pistol's muzzle face is nearer the bolt than the shipped one (${r.east.tip}px vs shipped ${r.legacyPistol}px; the bolt spawns at 34px)`, Math.abs(r.east.tip - 34) <= 10 && Math.abs(r.east.tip - 34) < Math.abs(r.legacyPistol - 34));
  check(`the rifle is longer than the pistol, its muzzle face nearer the bolt than the shipped rifle's (${r.rifle.tip}px vs shipped ${r.legacyRifle}px)`, r.rifle.key === 'p1-rifle' && r.rifle.tip > r.east.tip && Math.abs(r.rifle.tip - 34) < Math.abs(r.legacyRifle - 34));
  check('Super ready: the weapon wears its -hot variant (pistol and rifle)', r.hot.key === 'p1-pistol-hot' && r.rifleHot.key === 'p1-rifle-hot');
  check('mid-combo: p1-blade on the shipped blade pivot (origin 0.14)', r.blade.key === 'p1-blade' && r.blade.ox === 0.14, JSON.stringify(r.blade));
  await pB.close();
  // every bolt spawns where A spawns it
  const spawns = async (flags) => {
    const p = await boot(flags);
    const s = await p.evaluate(() => {
      const gs = window.__gs, P = gs.player;
      window.__clearArena(); window.__seed(77); window.__adv(5);
      const out = [];
      const grab = (g) => g.getChildren().filter((b) => b.active).map((b) => `${b.x.toFixed(3)},${b.y.toFixed(3)},${b.rotation.toFixed(4)}`).sort().join(' ');
      for (const a of [0, 0.7, 1.6, 2.5, 3.1, -0.4, -1.57, -2.4]) {
        P.fireCooldown = 0; P.ammo = 99; P.secondary = null; P.tryFire(a); window.__adv(1);
        out.push(`p${a}:${grab(gs.playerBullets)}`);
        P.fireCooldown = 0; P.secondary = 'rifle'; P.secondaryAmmo = 9; P.tryFire(a); window.__adv(12);
        out.push(`r${a}:${grab(gs.playerRifleBullets)}`);
        P.superCharge = 99; P.tryFireSuper(a); window.__adv(14);       // 70ms wind-up, under the Super's own 0.6x slow-mo
        out.push(`s${a}:${grab(gs.playerSuperBullets)}`);
        window.__adv(60);
      }
      return { out, draws: window.__draws };
    });
    await p.close();
    return s;
  };
  const sA = await spawns(A), sB = await spawns(B);
  const d = sA.out.findIndex((x, i) => x !== sB.out[i]);
  const empty = sA.out.filter((x) => !x.includes(',')).map((x) => x.split(':')[0]);
  check(`every pistol / rifle / Super bolt spawns at A's position and bearing (8 bearings, ${sA.out.length} volleys, ${sA.out.length - empty.length} with live bolts) with A's draw count`,
    d < 0 && sA.draws === sB.draws && empty.length === 0,
    d < 0 ? `draws ${sA.draws} / ${sB.draws}; volleys with no live bolt: ${empty.join(' ') || 'none'}` : `first difference: ${sA.out[d]?.slice(0, 60)} vs ${sB.out[d]?.slice(0, 60)}`);
}

// ── 6. SAME FIGHT ─────────────────────────────────────────────────────────
if (on(6)) console.log('\n== 6. same fight');
const SUPER = [700, 1400], MELEE = [320, 345, 370, 1000, 1030], RIFLE = 520;
async function replay(flags, q, { headless = true, ticks = TICKS, seed = 9071, base = NOW } = {}) {
  const p = await boot(flags, { base, q });
  const r = await p.evaluate((o) => window.__trace(o), { seed, ticks, seg: FIGHT_SEG, headless, melee: MELEE, rifleAt: RIFLE, superAt: SUPER });
  await p.close();
  return r;
}
const traces = {};
if (on(6)) for (const [label, q, base] of [['SWARM TIDE, production', Q_SWARM, ''], ['SWARM TIDE, legacy baseline', Q_SWARM, 'baseline=legacy'], ['BOMBER RUN, production', Q_BOMB, '']]) {
  const a = await replay([base, A].filter(Boolean).join('&'), q);
  const b = await replay([base, B].filter(Boolean).join('&'), q);
  traces[label] = a;
  const d = firstDiff(a.hashes, b.hashes);
  check(`${label}: ${TICKS} headless ticks, B identical to A (state + draws; pistol, rifle, 2 Supers, 2 melee chains)`, d < 0, d < 0 ? `${a.draws} draws` : `first divergent tick ${d}`);
}
if (on(6)) {
  const n = Math.min(TICKS, 500);
  const a = await replay(A, Q_SWARM, { headless: false, ticks: n }), b = await replay(B, Q_SWARM, { headless: false, ticks: n });
  const d = firstDiff(a.hashes, b.hashes);
  check(`SWARM TIDE, production: ${n} RENDERED ticks, B identical to A`, d < 0, d < 0 ? `${a.draws} draws` : `first divergent tick ${d}`);
}
if (on(6)) for (const [label, base] of [['R1', ''], ['V2', 'visualPilot=v2'], ['V2B', 'visualPilot=v2b']]) {
  const n = Math.min(TICKS, 800);
  const a = await replay(base, Q_SWARM, { ticks: n }), b = await replay([base, 'polish=p1'].filter(Boolean).join('&'), Q_SWARM, { ticks: n });
  const d = firstDiff(a.hashes, b.hashes);
  check(`${label} + ignored polish=p1: ${n} ticks identical to ${label}`, d < 0, d < 0 ? '' : `first divergent tick ${d}`);
}

// ── 7. FROZEN FILES ───────────────────────────────────────────────────────
if (on(7)) {
  console.log('\n== 7. frozen files');
  const paths = ['src/entities', 'src/config.js', 'src/data', 'src/systems/pixelArt.js', 'src/systems/rosterPaint.js', 'src/systems/vpPaint.js', 'src/systems/vpHangar.js', 'src/systems/visualPilot.js',
    'src/systems/CameraDirector.js', 'src/systems/EnvLight.js', 'src/systems/bulwarkStuck.js', 'src/systems/bulwarkAngle.js', 'src/systems/marksmanStuck.js', 'src/systems/marksmanAngle.js',
    'src/systems/firingSpot.js', 'src/systems/NavGrid.js', 'src/systems/controlLayout.js', 'src/main.js'];
  let diff = '';
  try { diff = execSync(`git diff --stat ${BASE_REV} -- ${paths.join(' ')}`, { encoding: 'utf8' }).trim(); } catch (e) { diff = `git failed: ${e.message}`; }
  check(`no change against ${BASE_REV} in entities (Player.js included), config, data, pixelArt, rosterPaint, the V2/V2B/V2C painters and seams, camera, light, AI seams, nav, controls`, diff === '', diff);
  const g = enemyJsGuard(process.cwd() + '/');
  check('Enemy.js guard (outside the Bomber, the Bomber-only veto)', g.outside && g.bomberOnlyVeto && g.vetoCode, g.detail);
}

// ── 8. AGAINST THE PREVIOUS BUILD ─────────────────────────────────────────
if (OLD && !SELF && on(8)) {
  console.log(`\n== 8. against the previous build (${OLD})`);
  for (const [label, flags] of [['R1 (no flags)', ''], ['V2', 'visualPilot=v2'], ['V2B', 'visualPilot=v2b'], ['V2C', A]]) {
    const pOld = await boot(flags, { base: OLD }), pNew = await boot(flags);
    const tOld = await pOld.evaluate(() => window.__allTex()), tNew = await pNew.evaluate(() => window.__allTex());
    const dk = [...new Set([...Object.keys(tOld), ...Object.keys(tNew)])].filter((k) => tOld[k] !== tNew[k]);
    check(`${label}: every texture byte-identical to the previous build`, dk.length === 0, dk.join(' '));
    await pOld.close(); await pNew.close();
  }
  for (const [label, q, oldFlags, newFlags] of [['SWARM TIDE, R1', Q_SWARM, '', ''], ['SWARM TIDE, V2C', Q_SWARM, A, A], ['SWARM TIDE, B vs the previous V2C', Q_SWARM, A, B], ['BOMBER RUN, R1', Q_BOMB, '', ''], ['SWARM TIDE, R1 + ignored polish=p1', Q_SWARM, '', 'polish=p1']]) {
    const a = await replay(oldFlags, q, { base: OLD }), b = await replay(newFlags, q);
    const d = firstDiff(a.hashes, b.hashes);
    check(`${label}: ${TICKS} ticks identical to the previous build`, d < 0, d < 0 ? `${a.draws} draws` : `first divergent tick ${d}`);
  }
} else if (!SELF) console.log('\n== 8. skipped (no --old=URL)');

// ── 9. RESTART AND RELOAD KEEP THE MODE ───────────────────────────────────
if (!SELF && on(9)) {
  console.log('\n== 9. restart and reload keep the mode');
  for (const [M, flags, on] of [['B', B, true], ['A', A, false]]) {
    const p = await boot(flags);
    const after = await p.evaluate(() => {
      const g = window.game, gs = window.__gs;
      gs.scene.start('Game', { mode: 'endless', seed: 4242 });
      for (let i = 0; i < 600 && !(gs.roomSpec && gs.player?.active); i++) window.__adv(1);
      window.__adv(20);
      return { p1: window.__dbg.isPolishP1(), inst: !!gs._p1Player, hud: Object.prototype.hasOwnProperty.call(g.scene.getScene('HUD'), 'showBanner'), ws: gs.player.weaponSprite.visible };
    });
    check(`${M}: a scene restart keeps the mode (P1 ${on ? 'installed' : 'absent'})`, after.p1 === on && after.inst === on && after.hud === on && after.ws === !on, JSON.stringify(after));
    await p.reload();
    await p.waitForFunction(() => window.game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 60000 });
    const rl = await p.evaluate(async () => {
      const u = performance.getEntriesByType('resource').map((r) => r.name).find((n) => /systems\/debug\.js/.test(n));
      const d = await import(u);
      return { p1: d.isPolishP1(), tex: window.game.textures.exists('p1-pistol') };
    });
    check(`${M}: a reload keeps the mode (and paints the p1 set only when on)`, rl.p1 === on && rl.tex === on, JSON.stringify(rl));
    await p.close();
  }
}

await browser.close();
const fails = results.filter((r) => !r.ok);
console.log(`\n${results.length - fails.length}/${results.length} passed${SELF ? '  (SELFTEST: sections 3, 5 and 6 are expected to FAIL)' : ''}`);
if (SELF) {
  const must = ['stays >= 24px inside', 'spawns at A\'s position', 'headless ticks, B identical', 'RENDERED ticks, B identical'];
  const ok = must.every((m) => fails.some((f) => f.name.includes(m)));
  console.log(ok ? 'SELFTEST OK: the checks caught the injected changes' : 'SELFTEST FAILED: a check did not catch an injected change');
  process.exit(ok ? 0 : 1);
}
process.exit(fails.length ? 1 : 0);
