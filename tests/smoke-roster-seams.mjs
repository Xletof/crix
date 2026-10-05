// ROSTER PHASE 1 — the integration seams, and the proof that they are inert.
//
// The roster visual redesign will arrive behind `?roster=v1`. Before a single
// new pixel is painted, this file pins what the seams must NOT change:
//
//   - LEGACY (no flag) must be the game that shipped at `88e9b89`. Every
//     gameplay field of every archetype, regular and elite, plus the legacy
//     sheet pixels and animation keys, is compared against a fixture captured
//     FROM `88e9b89` ITSELF (`--capture`), not against today's build — a check
//     that compares the build with itself passes on any regression.
//   - V1 may only change PRESENTATION. Every gameplay field must be identical
//     between the two flags, including the elite PHYSICS footprint, which is
//     coupled to render scale in Arcade (body width = sourceWidth * |scaleX|).
//   - Rusher behaviour no longer reads the art prefix, and still answers
//     exactly as the prefix used to: grunt yes; nemesis grunt NO (its prefix
//     was `nembrute`); everyone else no.
//   - The Bulwark contact projection is pure presentation and cannot move the
//     frontal-hit truth.
//
// usage: node tests/smoke-roster-seams.mjs            (check)
//        node tests/smoke-roster-seams.mjs --capture  (write the legacy fixture; run ONLY on 88e9b89)

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

const BASE = 'http://localhost:5173/';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const FIXTURE = new URL('./fixtures/roster-legacy-88e9b89.json', import.meta.url).pathname;
const CAPTURE = process.argv.includes('--capture');

const checks = [];
const check = (ok, label, detail) => { checks.push({ ok: !!ok, label, detail }); };
const fail = (m) => { console.error(`FAIL: ${m}`); process.exit(1); };

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
});

async function boot(query) {
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  page.on('pageerror', (e) => fail(`page error (${query}): ${e}`));
  await page.goto(BASE + query);
  await page.waitForTimeout(4500);
  await page.mouse.click(360, 640);
  await page.waitForTimeout(800);
  await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 4242 }));
  await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
  await page.waitForTimeout(2200);
  return page;
}

// Everything gameplay-relevant about a spawned archetype, plus what it LOOKS
// like (kept separate so v1 may differ in `look` and nowhere else).
const PROBE = () => {
  const gs = window.game.scene.getScene('Game');
  gs.arenaActive = false;
  for (const e of gs.enemies.getChildren().slice()) gs._destroyEnemyFully(e);
  const p = gs.player; p.x = 300; p.y = 300; p.body.reset(300, 300);
  const out = { units: {}, behaviour: {}, frontal: [], sheets: {}, anims: {} };
  const TYPES = ['grunt', 'shooter', 'shielded', 'sniper', 'bomber', 'swarmling'];
  for (const t of TYPES) for (const elite of [false, true]) {
    if (t === 'swarmling' && elite) continue;   // never promoted
    const e = gs.spawnEnemyAt(t, 900, 900, elite ? { elite: true } : {});
    e.body.updateFromGameObject?.();
    out.units[`${t}${elite ? '+E' : ''}`] = {
      play: {
        hp: e.hp, hpMax: e.hpMax, radius: e.cfg.radius, speed: e.cfg.speed,
        bodyW: e.body.width, bodyHalf: e.body.halfWidth,
        bodyDx: +(e.body.center.x - e.x).toFixed(3), bodyDy: +(e.body.center.y - e.y).toFixed(3),
        gunDist: e.weaponSprite ? e.cfg.radius - 4 : null, muzzleDist: e.cfg.radius + 4,
        shieldHalf: e._shieldHalfArc ?? null, shieldTurn: e._shieldTurnRate ?? null,
        elite: !!e._elite, rusher: e._isRusher ?? null,
      },
      look: {
        tex: e.texture.key, prefix: e._animPrefix, scale: +e.scaleX.toFixed(4), baseScale: e._baseScale,
        tint: e.tintTopLeft, weapon: e.weaponSprite?.texture?.key ?? null, weaponVis: e.weaponSprite?.visible ?? null,
      },
    };
    gs._destroyEnemyFully(e);
  }
  // RUSHER, by behaviour: player 200px east is inside a rusher's chase range
  // (>150) and inside a holder's strafe pocket (160-340). A rusher closes; a
  // holder strafes perpendicular.
  const rush = (make) => {
    const e = make(); e.x = 600; e.y = 600; e.body.reset(600, 600);
    p.x = 800; p.y = 600; p.body.reset(800, 600);
    e._tickSwarm(16, p);
    const v = { vx: Math.round(e.body.velocity.x), vy: Math.round(e.body.velocity.y) };
    gs._destroyEnemyFully(e);
    return v.vx > 50 && Math.abs(v.vy) < 5 ? 'closes' : 'holds';
  };
  for (const t of ['grunt', 'shooter', 'shielded', 'bomber', 'swarmling']) out.behaviour[t] = rush(() => gs.spawnEnemyAt(t, 600, 600, {}));
  out.behaviour['grunt+E'] = rush(() => gs.spawnEnemyAt('grunt', 600, 600, { elite: true }));
  out.behaviour['nemesis-grunt'] = rush(() => { const e = gs.spawnEnemyAt('grunt', 600, 600, {}); gs._wearNemesisBody(e, { base: 'grunt' }); return e; });
  // FRONTAL TRUTH on the stock shield, 16 bearings
  const s = gs.spawnEnemyAt('shielded', 600, 600, {}); s._shieldFacing = 0.3;
  for (let i = 0; i < 16; i++) out.frontal.push(s.isFrontalHit(i * Math.PI / 8) ? 1 : 0);
  gs._destroyEnemyFully(s);
  // LEGACY SHEET PIXELS + ANIMATION KEYS
  const hash = (key) => {
    const src = gs.textures.get(key).getSourceImage();
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    const x = c.getContext('2d'); x.drawImage(src, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data; let h = 2166136261;
    for (let i = 0; i < d.length; i++) { h ^= d[i]; h = Math.imul(h, 16777619) >>> 0; }
    return `${c.width}x${c.height}:${h}`;
  };
  for (const k of ['grunt', 'shooter', 'wpn-enemy-rifle', 'nem-brute', 'nem-demo', 'nem-marks']) out.sheets[k] = hash(k);
  for (const pre of ['grunt', 'shooter']) {
    out.anims[pre] = ['idle', 'walk', 'fire', 'raise', 'thrust', 'recoil']
      .flatMap((a) => ['front', 'back', 'side'].map((d) => `${pre}-${a}-${d}`))
      .filter((k) => gs.anims.exists(k)).length;
  }
  return out;
};

// ── LEGACY ───────────────────────────────────────────────────────────────
const pL = await boot('?nodlg=1&nofreeze=1');
const legacy = await pL.evaluate(PROBE);
await pL.close();

if (CAPTURE) {
  // Rusher was never a field before the seam: record what behaviour PROVED.
  mkdirSync(new URL('./fixtures/', import.meta.url).pathname, { recursive: true });
  writeFileSync(FIXTURE, JSON.stringify(legacy, null, 1));
  console.log(`captured legacy fixture -> ${FIXTURE}`);
  await browser.close();
  process.exit(0);
}

if (!existsSync(FIXTURE)) fail(`no fixture at ${FIXTURE} — capture it from 88e9b89 first`);
const hist = JSON.parse(readFileSync(FIXTURE, 'utf8'));

// Legacy == history, field by field. `rusher` was null at 88e9b89 (no field);
// it is checked against BEHAVIOUR below instead.
for (const [k, h] of Object.entries(hist.units)) {
  const n = legacy.units[k];
  const { rusher: _r, ...hp } = h.play; const { rusher: _r2, ...np } = n.play;
  check(JSON.stringify(hp) === JSON.stringify(np), `legacy ${k}: gameplay identical to 88e9b89`, `${JSON.stringify(hp)} vs ${JSON.stringify(np)}`);
  check(JSON.stringify(h.look) === JSON.stringify(n.look), `legacy ${k}: presentation identical to 88e9b89`, `${JSON.stringify(h.look)} vs ${JSON.stringify(n.look)}`);
}
check(JSON.stringify(hist.behaviour) === JSON.stringify(legacy.behaviour), 'rusher BEHAVIOUR identical to 88e9b89 (grunt closes, nemesis grunt holds, …)', JSON.stringify(legacy.behaviour));
check(JSON.stringify(hist.frontal) === JSON.stringify(legacy.frontal), 'shield frontal-hit truth identical on 16 bearings', legacy.frontal.join(''));
check(JSON.stringify(hist.sheets) === JSON.stringify(legacy.sheets), 'legacy sheet + rifle + nemesis texture PIXELS identical', JSON.stringify(legacy.sheets));
check(legacy.anims.grunt === 18 && legacy.anims.shooter === 18 && JSON.stringify(hist.anims) === JSON.stringify(legacy.anims),
  'grunt/shooter keep all 18 animation keys (9 idle/walk/fire + 9 poses)', JSON.stringify(legacy.anims));

// the rusher FIELD, now explicit, must agree with the measured behaviour
const want = { grunt: true, 'grunt+E': true, shooter: false, 'shooter+E': false, shielded: false, sniper: false };
for (const [k, v] of Object.entries(want)) check(legacy.units[k].play.rusher === v, `_isRusher on ${k} is ${v}`, String(legacy.units[k].play.rusher));

// ── V1: change NO gameplay; roles without production art fall back to legacy ──
// Phase 2A gave the GUNNER (`shooter`) its production art (`smoke-roster-gunner`),
// Phase 2B the RIFLEMAN (`grunt`) and MARKSMAN (`sniper`) (`smoke-roster-2b`).
// Every other role still falls back.
const V1_ROLES = { shooter: 'ro-gun-R', 'shooter+E': 'ro-gun-E', grunt: 'ro-rif-R', 'grunt+E': 'ro-rif-E', sniper: 'ro-mrk-R', 'sniper+E': 'ro-mrk-E' };
const pV = await boot('?nodlg=1&nofreeze=1&roster=v1');
const v1 = await pV.evaluate(PROBE);
const flags = await pV.evaluate(async () => {
  const url = performance.getEntriesByType('resource').map((r) => r.name).find((n) => /systems\/debug\.js/.test(n));
  const dbg = await import(url);
  return { roster: dbg.getRosterVersion?.() ?? null };
});
check(flags.roster === 'v1', '?roster=v1 sets the roster flag', JSON.stringify(flags));
for (const k of Object.keys(legacy.units)) {
  check(JSON.stringify(legacy.units[k].play) === JSON.stringify(v1.units[k].play), `v1 ${k}: gameplay identical to legacy`, `${JSON.stringify(v1.units[k].play)}`);
  if (V1_ROLES[k]) check(v1.units[k].look.tex === V1_ROLES[k], `v1 ${k}: wears its production art (${V1_ROLES[k]})`, JSON.stringify(v1.units[k].look));
  else check(JSON.stringify(legacy.units[k].look) === JSON.stringify(v1.units[k].look), `v1 ${k}: no v1 art registered, so presentation falls back to legacy`, JSON.stringify(v1.units[k].look));
}
check(JSON.stringify(v1.behaviour) === JSON.stringify(legacy.behaviour), 'v1 rusher behaviour identical', JSON.stringify(v1.behaviour));

// ── V1 elite presentation PATH, exercised with a stand-in texture ────────────
// The generic path, on a stand-in registration (it REPLACES grunt's / sniper's
// real art for this block only; their production art is covered by
// smoke-roster-2b): register a throwaway 96x104 texture in
// the game's OWN registry instance and prove: scale 1, no tint, texture used,
// body centred, and the PHYSICS footprint identical to legacy.
const elitePath = await pV.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const url = performance.getEntriesByType('resource').map((r) => r.name).find((n) => /data\/rosterArt\.js/.test(n));
  if (!url) return { err: 'rosterArt module not loaded' };
  const ra = await import(url);
  const c = gs.textures.createCanvas('test-elite-shooter', 96, 104); c.context.fillStyle = '#888'; c.context.fillRect(20, 10, 56, 90); c.refresh();
  ra.registerRosterArt('grunt', { elite: { tex: 'test-elite-shooter' } });
  const e = gs.spawnEnemyAt('grunt', 700, 700, { elite: true }); e.body.updateFromGameObject();
  const r = {
    tex: e.texture.key, scale: e.scaleX, baseScale: e._baseScale, tint: e.tintTopLeft,
    radius: e.cfg.radius, bodyW: e.body.width, bodyHalf: e.body.halfWidth,
    dx: +(e.body.center.x - e.x).toFixed(3), dy: +(e.body.center.y - e.y).toFixed(3), hp: e.hp, speed: e.cfg.speed,
  };
  // the REGULAR path: same texture swap, collider at cfg.radius, centred
  ra.registerRosterArt('sniper', { regular: { tex: 'test-elite-shooter' } });
  const rg = gs.spawnEnemyAt('sniper', 650, 650, {}); rg.body.updateFromGameObject();
  r.regular = { tex: rg.texture.key, radius: rg.cfg.radius, bodyW: rg.body.width, dx: +(rg.body.center.x - rg.x).toFixed(3), dy: +(rg.body.center.y - rg.y).toFixed(3), tint: rg.tintTopLeft };
  gs._destroyEnemyFully(rg); ra.registerRosterArt('sniper', null);
  // squash parity: the legacy body breathes with the 1.4 render scale; v1 must breathe identically
  e.setScale(0.9); e.body.updateFromGameObject(); r.bodyWSquash = e.body.width; e.setScale(1);
  // a nemesis must stay on legacy presentation even with v1 art registered
  const n = gs._spawnMiniBoss();
  r.nemesis = { tex: n.texture.key, scale: +n.scaleX.toFixed(3), tinted: n.tintTopLeft !== 0xffffff };
  ra.registerRosterArt('grunt', null);
  gs._destroyEnemyFully(e); gs._destroyEnemyFully(n);
  return r;
});
const le = legacy.units['grunt+E'].play;
check(!elitePath.err, 'rosterArt module is part of the running game', elitePath.err);
check(elitePath.tex === 'test-elite-shooter' && elitePath.scale === 1 && elitePath.baseScale === 1 && elitePath.tint === 0xffffff,
  'v1 elite with art: dedicated texture, render scale 1.0, NO gold tint', JSON.stringify(elitePath));
check(elitePath.radius === le.radius && elitePath.hp === le.hp && elitePath.speed === le.speed,
  'v1 elite keeps the historical radius / hp / speed', `${elitePath.radius}/${elitePath.hp}/${elitePath.speed} vs ${le.radius}/${le.hp}/${le.speed}`);
check(Math.abs(elitePath.bodyW - le.bodyW) < 1e-6 && elitePath.bodyHalf === le.bodyHalf,
  'v1 elite keeps the historical PHYSICS footprint (Arcade scales body with sprite scale)', `${elitePath.bodyW}/${elitePath.bodyHalf} vs ${le.bodyW}/${le.bodyHalf}`);
check(Math.abs(elitePath.bodyWSquash - le.bodyW * 0.9) < 1e-6,   // legacy: 60px source x (1.4 x 0.9); v1: 84px source x 0.9
  'squash parity: a 0.9 squash scales the v1 body exactly as it scales the legacy one', `${elitePath.bodyWSquash}`);
check(Math.abs(elitePath.dx) < 1e-6 && Math.abs(elitePath.dy) < 1e-6, 'body stays CENTRED after the presentation texture swap', `${elitePath.dx},${elitePath.dy}`);
const ls = legacy.units.sniper.play;
check(elitePath.regular && elitePath.regular.tex === 'test-elite-shooter' && elitePath.regular.radius === ls.radius && elitePath.regular.bodyW === ls.bodyW
  && elitePath.regular.dx === 0 && elitePath.regular.dy === 0 && elitePath.regular.tint === 0xffffff,
  'v1 REGULAR with art: texture swapped, identity tint dropped (baked art), collider identical and centred', JSON.stringify(elitePath.regular));
check(elitePath.nemesis && elitePath.nemesis.tex.startsWith('nem-') && elitePath.nemesis.scale !== 1 && elitePath.nemesis.tinted,
  'a nemesis keeps legacy presentation (own sheet, render scale, tint) even with v1 art registered', JSON.stringify(elitePath.nemesis));
await pV.close();

// ── BULWARK CONTACT PROJECTION: pure, and blind to the block decision ──────
const pP = await boot('?nodlg=1&nofreeze=1');
const proj = await pP.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const url = performance.getEntriesByType('resource').map((r) => r.name).find((n) => /systems\/shieldContact\.js/.test(n));
  if (!url) return { err: 'shieldContact module not loaded' };
  const sc = await import(url);
  const out = { onR: true, inArc: true, cases: 0, frontalSame: true, recorded: null };
  const s = gs.spawnEnemyAt('shielded', 600, 600, {}); s._shieldFacing = Math.PI / 2;
  for (let i = 0; i < 24; i++) {
    const flight = -Math.PI / 2 + (i - 12) * 0.09;           // bolts travelling north-ish into a south-facing shield
    const bx = 600 + Math.cos(flight + Math.PI) * 26, by = 600 + Math.sin(flight + Math.PI) * 26;
    const before = s.isFrontalHit(flight);
    const c = sc.projectCurtainContact(s.x, s.y, bx, by, flight, s._shieldFacing, s._shieldHalfArc, sc.curtainRadius(s));
    const after = s.isFrontalHit(flight);
    out.cases++;
    if (Math.abs(Math.hypot(c.x - s.x, c.y - s.y) - sc.curtainRadius(s)) > 0.01) out.onR = false;
    if (Math.abs(c.off) > s._shieldHalfArc + 1e-9) out.inArc = false;
    if (before !== after) out.frontalSame = false;
  }
  // the seam records, it does not decide: onBlock / onPierce store the contact and nothing else
  const hpBefore = s.hp;
  s.onBlock({ x: 1, y: 2, off: 0.1 }); s.onPierce?.({ x: 3, y: 4, off: -0.2 });
  out.recorded = { block: s._lastBlockContact?.off ?? null, pierce: s._lastPierceContact?.off ?? null, hpSame: s.hp === hpBefore, flash: s._shieldFlash };
  out.r = sc.curtainRadius(s);
  gs._destroyEnemyFully(s);
  return out;
});
check(!proj.err, 'shieldContact module is part of the running game', proj.err);
check(proj.onR && proj.inArc && proj.cases === 24, `projected contact lies ON the curtain radius (${proj.r}) and inside ±halfArc, 24 bolts`, JSON.stringify(proj));
check(proj.frontalSame, 'projection does not move the frontal-hit truth', '');
check(proj.recorded && proj.recorded.block === 0.1 && proj.recorded.pierce === -0.2 && proj.recorded.hpSame && proj.recorded.flash === 150,
  'onBlock/onPierce RECORD the contact; legacy flash (150ms) unchanged; no damage', JSON.stringify(proj.recorded));
await pP.close();

// ── DEBUG COLLIDER VIEW: absent without the flag, present with it ─────────
const colliderGfx = async (q) => {
  const pg = await boot(q);
  const n = await pg.evaluate(() => { const gs = window.game.scene.getScene('Game'); return !!gs._colliderGfx; });
  await pg.close(); return n;
};
check(!(await colliderGfx('?nodlg=1')), 'collider view does NOT exist without ?colliders=1', '');
check(await colliderGfx('?nodlg=1&colliders=1'), 'collider view exists with ?colliders=1', '');

await browser.close();
let bad = 0;
for (const c of checks) { console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.label}${c.ok ? '' : `  [${c.detail}]`}`); if (!c.ok) bad++; }
console.log(`\n${checks.length - bad}/${checks.length} checks passed`);
process.exit(bad ? 1 : 0);
