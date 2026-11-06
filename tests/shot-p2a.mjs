// EVIDENCE: P2-A — BLASTER FIRE & IMPACT (`?visualPilot=v2c&polish=p1&fxPilot=p2a`).
// Standalone; needs `npm run dev` on :5173 and ffmpeg.
//
// A = `visualPilot=v2c&polish=p1` (approved, frozen), B = A + `fxPilot=p2a`.
// Every scene is a SEEDED, staged moment run once per configuration on the
// same seed and the same inputs, rendered tick by tick at the real 60 Hz step
// (`game.step(t, 16.67)`), so A and B show the same shot on the same frame.
// Before writing anything the rig compares a per-tick gameplay hash (player,
// enemies, every live bolt, Math.random draws) between A and B and refuses to
// publish a pair that differs — a film of a different fight is not evidence.
//
// Close-ups (world-anchored crops, every tick from the trigger):
//   pistol   one pistol shot into a Rifleman at ~260px
//   rifle    one DC-15 burst into the same target
//   wall     a pistol shot into a crate's face, and a diagonal one off its corner
//   enemy    pistol shots into a Gunner (Roster v1 armour) and a swarmling
//   shield   pistol shots into a Bulwark's field (the frozen field answers)
//   shieldbare  the same into a shield-bearer without the field (a nemesis Bulwark)
//   multi    four targets, rapid fire across them
// Films (full frame, phone size and 540w):
//   fight-swarm      SWARM TIDE, Hangar, sector 3
//   fight-crossfire  CROSSFIRE, Hangar, sector 6
//
// `--set=p2a2`: A = P2-A, B = P2-A2 (the carbine). `--set=p2a3`: A = P2-A2,
// B = P2-A3 (the OVERRIDE refinement: HUD count, readout, power cell, beats).
// `--set=p2a3mz`: A = P2-A3 (current STANDARD discharge), B = P2-A3 +
// `muzzle=sharp` — sustained fire in four states, at 60 Hz and a 30 Hz step.
// The p2a3 sets render EVERY tick (60 fps films; 30 fps for the 30 Hz scenes).
//
// usage: node tests/shot-p2a.mjs --out=DIR [--frames=TMPDIR] [--only=pistol,rifle,...] [--a=FLAGS] [--b=FLAGS]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { execSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { CHROME, bootPage } from './diag-stuck-audit.mjs';

const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
// --set=p2a2: the P2-A2 evidence (A = P2-A, B = P2-A2, its own scene list)
const SET = opt('set', 'p2a');
const P1F = 'visualPilot=v2c&polish=p1';
const DEF = {
  p2a: ['docs/evidence/combat-vfx-p2a', P1F, `${P1F}&fxPilot=p2a`],
  p2a2: ['docs/evidence/combat-vfx-p2a2', `${P1F}&fxPilot=p2a`, `${P1F}&fxPilot=p2a2`],
  p2a3: ['docs/evidence/combat-vfx-p2a3', `${P1F}&fxPilot=p2a2`, `${P1F}&fxPilot=p2a3`],
  p2a3mz: ['docs/evidence/combat-vfx-p2a3/muzzle-ab', `${P1F}&fxPilot=p2a3`, `${P1F}&fxPilot=p2a3&muzzle=sharp`],
}[SET];
const OUT = opt('out', DEF[0]);
const A = opt('a', DEF[1]);
const B = opt('b', DEF[2]);
const EVERY = SET.startsWith('p2a3') ? 1 : 2;   // fights: every tick (60 fps) for the p2a3 sets
const ONLY = opt('only', '') ? new Set(opt('only', '').split(',')) : null;
const want = (n) => !ONLY || ONLY.has(n);
const BASE = opt('base', 'http://localhost:5173/');
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const sh = (c) => execSync(c, { stdio: 'pipe' }).toString();
const fnv = (str) => { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0; return h; };

async function boot(flags, q, seed = 4242) {
  const p = await bootPage(browser, { base: BASE, flags, baseline: null, q, seed });
  await p.evaluate(async () => {
    const gs = window.__gs;
    window.__WP = (await window.__mod(/entities\/WeaponPickup\.js/))?.WeaponPickup;
    window.__clear = () => {
      gs.arenaActive = false; gs._spawnQueue = [];
      gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
      gs._roomModifier = null;
      for (const g of [...gs.hostileBullets, gs.playerBullets, gs.playerRifleBullets]) for (const b of g.getChildren()) if (b.active) b.kill();
    };
    const f = (v) => (Math.round(v * 1000) / 1000).toString();
    window.__state = () => {
      const P = gs.player;
      let s = `${f(P.x)},${f(P.y)},${P.hp},${P.superCharge}|`;
      for (const e of gs.enemies.getChildren()) if (e.active) s += `${e.enemyType}:${f(e.x)},${f(e.y)},${Math.round(e.hp)};`;
      for (const g of [...gs.hostileBullets, gs.playerBullets, gs.playerRifleBullets, gs.playerSuperBullets]) for (const b of g.getChildren()) if (b.active) s += `b${f(b.x)},${f(b.y)},${f(b.rotation)};`;
      return `${s}|d${window.__draws}`;
    };
    // world rect -> canvas-pixel rect through the live camera
    window.__clip = (x0, y0, x1, y1) => {
      const cam = gs.cameras.main, wv = cam.worldView, z = cam.zoom;
      const sx = (wx) => (wx - wv.x) * z + cam.x, sy = (wy) => (wy - wv.y) * z + cam.y;
      // a FIXED pixel size (the rect at zoom 1), world-anchored, kept on the canvas
      const w = Math.round(x1 - x0), h = Math.round(y1 - y0);
      const x = Math.max(0, Math.min(720 - w, Math.round(sx((x0 + x1) / 2) - w / 2)));
      const y = Math.max(84, Math.min(1280 - h, Math.round(sy((y0 + y1) / 2) - h / 2)));
      return { x, y, width: w, height: h, raw: [sx(x0), sy(y0), z] };
    };
  });
  return p;
}

// ── staged scenes ──────────────────────────────────────────────────────────
// `setup` runs once (seeded); `act(i)` runs before step i; `rect` is the world
// crop. Everything a scene does is gameplay input the A and B runs share.
const SCENES = {
  pistol: {
    strip: [0, 14, 1],   // the A | B phone strip: ticks [from, to) by step
    ticks: 26, rect: [700, 720, 1080, 900],
    setup: `P.x = 760; P.y = 810; P.body.reset(760, 810); P.facing = 0;
            const e = gs.spawnEnemyAt('grunt', 1020, 810); window.__T = [e];`,
    act: `if (i === 0) P.tryFire(Math.atan2(T[0].y - P.y, T[0].x - P.x));`,
  },
  rifle: {
    strip: [0, 18, 1],   // the A | B phone strip: ticks [from, to) by step
    ticks: 30, rect: [700, 720, 1080, 900],
    setup: `P.x = 760; P.y = 810; P.body.reset(760, 810); P.facing = 0;
            P.secondary = 'rifle'; P.secondaryAmmo = 27; gs.events.emit('secondary-equipped', 'rifle');
            const e = gs.spawnEnemyAt('grunt', 1020, 810); window.__T = [e];`,
    act: `if (i === 0) P.tryFire(Math.atan2(T[0].y - P.y, T[0].x - P.x));`,
  },
  wall: {
    strip: [10, 32, 2],   // the A | B phone strip: ticks [from, to) by step
    ticks: 34, rect: [720, 300, 960, 680],
    setup: `P.x = 840; P.y = 620; P.body.reset(840, 620); P.facing = -Math.PI / 2; window.__T = [];`,
    act: `if (i === 0) P.tryFire(-Math.PI / 2);
          if (i === 14) P.tryFire(Math.atan2(395 - P.y, 812 - P.x));`,
  },
  enemy: {
    strip: [8, 24, 1],   // the A | B phone strip: ticks [from, to) by step
    ticks: 40, rect: [700, 600, 1100, 840],
    setup: `P.x = 760; P.y = 720; P.body.reset(760, 720); P.facing = 0;
            const g = gs.spawnEnemyAt('shooter', 1010, 670); const s = gs.spawnEnemyAt('swarmling', 960, 790);
            window.__T = [g, s];`,
    act: `if (i === 0) P.tryFire(Math.atan2(T[0].y - P.y, T[0].x - P.x));
          if (i === 16 && T[1].alive) P.tryFire(Math.atan2(T[1].y - P.y, T[1].x - P.x));`,
  },
  shield: {
    strip: [0, 24, 2],   // the A | B phone strip: ticks [from, to) by step
    ticks: 40, pre: 70, rect: [720, 720, 1100, 900],
    setup: `P.x = 780; P.y = 810; P.body.reset(780, 810); P.facing = 0;
            const e = gs.spawnEnemyAt('shielded', 1010, 810); window.__T = [e];`,
    act: `if (i === 0 || i === 9 || i === 18) P.tryFire(Math.atan2(T[0].y - P.y, T[0].x - P.x));`,
  },
  // a shield-bearer WITHOUT the roster-v1 field — how a nemesis Bulwark (legacy art) blocks
  shieldbare: {
    strip: [0, 24, 2],   // the A | B phone strip: ticks [from, to) by step
    ticks: 40, pre: 70, rect: [720, 720, 1100, 900],
    setup: `P.x = 780; P.y = 810; P.body.reset(780, 810); P.facing = 0;
            const e = gs.spawnEnemyAt('shielded', 1010, 810, { legacyArt: true }); window.__T = [e];`,
    act: `if (i === 0 || i === 9 || i === 18) P.tryFire(Math.atan2(T[0].y - P.y, T[0].x - P.x));`,
  },
  multi: {
    strip: [0, 60, 4],   // the A | B phone strip: ticks [from, to) by step
    ticks: 60, rect: [620, 480, 1180, 960],
    setup: `P.x = 800; P.y = 720; P.body.reset(800, 720);
            window.__T = [gs.spawnEnemyAt('grunt', 1080, 600), gs.spawnEnemyAt('shooter', 1100, 820), gs.spawnEnemyAt('grunt', 960, 900), gs.spawnEnemyAt('swarmling', 1000, 520)];`,
    act: `if (i % 8 === 0) { const t = T.filter((e) => e.active && e.alive)[(i / 8) % 4 | 0] || T.find((e) => e.alive); if (t) P.tryFire(Math.atan2(t.y - P.y, t.x - P.x)); }`,
  },
};

// ── the P2-A2 set (`--set=p2a2`): A = P2-A, B = P2-A2 ─────────────────────
const KEEP = (o) => `P.shieldHp = ${o.shield ? 50 : 0}; P.superCharge = ${o.ready ? 99 : 0};`;
const ringed = (o, name) => ({
  strip: [0, 24, 2], ticks: 30, rect: [650, 700, 870, 920], full: [1, 15],
  setup: `P.x = 760; P.y = 810; P.body.reset(760, 810); P.facing = 0; ${KEEP(o)}
          const e = gs.spawnEnemyAt('grunt', 1020, 810); window.__T = [e];`,
  act: `${KEEP(o)} if (i === 0 || i === 14) { P.fireCooldown = 0; P.tryFire(Math.atan2(T[0].y - P.y, T[0].x - P.x)); }`,
  note: name,
});
const SCENES_P2A2 = {
  standard: {
    strip: [0, 16, 1], ticks: 30, rect: [700, 720, 1080, 900],
    setup: `P.x = 760; P.y = 810; P.body.reset(760, 810); P.facing = 0;
            const e = gs.spawnEnemyAt('grunt', 1020, 810); window.__T = [e];`,
    act: `if (i === 0 || i === 16) { P.fireCooldown = 0; P.tryFire(Math.atan2(T[0].y - P.y, T[0].x - P.x)); }`,
  },
  override: {
    strip: [3, 25, 1], ticks: 34, rect: [700, 720, 1080, 900],
    setup: `P.x = 760; P.y = 810; P.body.reset(760, 810); P.facing = 0;
            gs.weaponPickups.push(new window.__WP(gs, P.x, P.y, 'rifle'));
            const e = gs.spawnEnemyAt('grunt', 1020, 810); window.__T = [e];`,
    act: `if (i === 3) P.tryFire(Math.atan2(T[0].y - P.y, T[0].x - P.x));`,
  },
  shieldfire: ringed({ shield: 1 }, 'shield'),
  readyfire: ringed({ ready: 1 }, 'ready'),
  bothfire: ringed({ shield: 1, ready: 1 }, 'both'),
  aim8: {
    strip: [1, 80, 10], ticks: 80, rect: [650, 650, 950, 950],
    setup: `P.x = 800; P.y = 800; P.body.reset(800, 800); window.__T = [];`,
    act: `if (i % 10 === 0) { P.fireCooldown = 0; P.tryFire((i / 10) * Math.PI / 4); }`,
  },
  // the whole loop at phone size: the module dropped ahead, walked onto,
  // bursts until it runs dry, then the same gun fires STANDARD again
  sequence: {
    strip: [0, 280, 14], ticks: 280, rect: null, full: [8, 46, 70, 110, 200, 262],
    setup: `P.x = 610; P.y = 860; P.body.reset(610, 860); gs.spawnWeaponChoice(760, 660, 'REWARD'); window.__T = [];`,
    act: `gs.keys.W.isDown = i >= 10 && i < 50;
          if (i >= 60) P.tryFire(-0.35);`,
  },
};
// ── the P2-A3 set (`--set=p2a3`): A = P2-A2, B = P2-A3 ─────────────────────
// one real OVERRIDE module, fired until it runs dry, then STANDARD
const MODULE = `P.x = 760; P.y = 810; P.body.reset(760, 810); P.facing = 0;
          gs.weaponPickups.push(new window.__WP(gs, P.x, P.y, 'rifle')); window.__T = [];`;
const SCENES_P2A3 = {
  // the HUD panel (screen space): the count and bar every round; run dry -> STANDARD
  hud: { screen: [40, 930, 172, 144], strip: [14, 300, 12], ticks: 300, setup: MODULE, act: `if (i >= 20) P.tryFire(-0.2);` },
  // the hero: the engage beat (pips in sequence, the ring, the HUD rim), then the first bursts
  engage: { rect: [680, 745, 860, 880], strip: [0, 46, 2], ticks: 60, setup: MODULE, act: `if (i >= 24) P.tryFire(-0.2);` },
  // the last two bursts (the pulse), running dry (pips out, the cell gutters), STANDARD after
  rundry: { rect: [680, 745, 860, 880], strip: [0, 84, 3], ticks: 90,
    setup: `P.x = 760; P.y = 810; P.body.reset(760, 810); P.facing = 0; P.equipSecondary('rifle'); P.secondaryAmmo = 6; gs.events.emit('secondary-ammo-changed'); window.__T = [];`,
    act: `if (i >= 20 && i % 2 === 0) P.tryFire(-0.2);` },
  // the whole loop, full frame at phone size: the module dropped ahead, walked onto, fired dry, STANDARD after
  sequence: { strip: [0, 330, 15], ticks: 330, rect: null, full: [12, 40, 70, 120, 200, 236, 262, 300],
    setup: `P.x = 610; P.y = 860; P.body.reset(610, 860); gs.spawnWeaponChoice(760, 660, 'REWARD'); window.__T = [];`,
    act: `gs.keys.W.isDown = i >= 10 && i < 50;
          if (i >= 60) P.tryFire(-0.35);` },
};
// ── the STANDARD discharge A/B (`--set=p2a3mz`): A = P2-A3, B = P2-A3 + muzzle=sharp
// a held trigger: the shipped pool (3 rounds, 120ms apart, then the 520ms refill)
const HELD = (o) => ({
  rect: [660, 735, 940, 890], strip: [0, 40, 1], ticks: 90,
  setup: `P.x = 760; P.y = 810; P.body.reset(760, 810); P.facing = 0.2; ${KEEP(o)} P.ammo = 3; P.ammoTimers = []; window.__T = [];`,
  act: `${KEEP(o)} P.tryFire(0.2);`, ...(o.step ? { step: o.step } : {}),
});
const SCENES_P2A3MZ = {
  'held-none': HELD({}), 'held-shield': HELD({ shield: 1 }), 'held-ready': HELD({ ready: 1 }), 'held-both': HELD({ shield: 1, ready: 1 }),
  // the same at a 30 Hz step (a phone that cannot hold 60 fps)
  'held30-none': { ...HELD({ step: 1000 / 30 }), ticks: 45, strip: [0, 20, 1] }, 'held30-both': { ...HELD({ shield: 1, ready: 1, step: 1000 / 30 }), ticks: 45, strip: [0, 20, 1] },
  // full frame at phone size: 2s in each state, trigger held throughout
  'held-full': { strip: [0, 480, 24], ticks: 480, rect: null, full: [62, 182, 302, 422],
    setup: `P.x = 760; P.y = 810; P.body.reset(760, 810); P.facing = 0.2; P.ammo = 3; P.ammoTimers = []; window.__T = [];`,
    act: `const ph = Math.floor(i / 120); P.shieldHp = ph === 1 || ph === 3 ? 50 : 0; P.superCharge = ph >= 2 ? 99 : 0; P.tryFire(0.2);` },
};
const SCENE_SET = { p2a: SCENES, p2a2: SCENES_P2A2, p2a3: SCENES_P2A3, p2a3mz: SCENES_P2A3MZ }[SET];

async function stage(flags, name, dir) {
  const S = SCENE_SET[name];
  const p = await boot(flags, 'room=hangar');
  await p.evaluate(({ setup }) => {
    const gs = window.__gs, P = gs.player;
    window.__clear();
    window.__headless = true; window.__adv(300); window.__headless = false;   // the room's banners are over
    window.__clear();
    // the camera settles on the hero's mark before anything is staged
    const m = /P\.x = (\d+); P\.y = (\d+)/.exec(setup);
    P.x = +m[1]; P.y = +m[2]; P.body.reset(P.x, P.y);
    window.__headless = true; window.__adv(60); window.__headless = false;
    window.__seed(9001); window.__draws = 0;
    new Function('gs', 'P', setup)(gs, P);
    window.__adv(1);
  }, { setup: S.setup });
  if (S.pre) await p.evaluate((n) => { window.__headless = true; window.__adv(n); window.__headless = false; }, S.pre);
  const hashes = [];
  if (dir) mkdirSync(dir, { recursive: true });
  for (let i = 0; i < S.ticks; i++) {
    const r = await p.evaluate(({ i, act, rect, screen, step }) => {
      const gs = window.__gs, P = gs.player, T = window.__T;
      new Function('gs', 'P', 'T', 'i', act)(gs, P, T, i);
      if (step) { window.__t += step; window.game.step(window.__t, step); } else window.__adv(1);
      return { s: window.__state(), clip: screen ? { x: screen[0], y: screen[1], width: screen[2], height: screen[3] } : rect ? window.__clip(...rect) : null };
    }, { i, act: S.act, rect: S.rect, screen: S.screen || null, step: S.step || 0 });
    hashes.push(fnv(r.s));
    if (dir) await p.screenshot({ path: `${dir}/f${String(i).padStart(3, '0')}.png`, ...(r.clip ? { clip: r.clip } : {}) });
    if (dir && S.full?.includes(i)) await p.screenshot({ path: `${dir}/full${String(i).padStart(3, '0')}.png` });
  }
  await p.close();
  return hashes;
}

// ── fights ────────────────────────────────────────────────────────────────
const FIGHTS = {
  'fight-swarm': { q: 'encdbg=swarmTide&room=hangar&sector=3', ticks: 420, seed: 4242 },
  'fight-crossfire': { q: 'encdbg=crossfire&room=hangar&sector=6', ticks: 420, seed: 4243 },
};
async function fight(flags, name, dir) {
  const F = FIGHTS[name];
  const p = await boot(flags, F.q, F.seed);
  await p.evaluate(() => { window.__seed(777); window.__draws = 0; });
  const seg = [[0, 70, 'D'], [70, 130, 'S'], [130, 200, 'DW'], [200, 260, ''], [260, 330, 'A'], [330, 380, 'W'], [380, 9999, 'D']];
  const hashes = [];
  if (dir) mkdirSync(dir, { recursive: true });
  for (let i = 0; i < F.ticks; i++) {
    const s = await p.evaluate(({ i, seg, set }) => {
      const gs = window.__gs, P = gs.player, K = gs.keys;
      const cur = seg.find(([a, b]) => i >= a && i < b)[2];
      K.A.isDown = cur.includes('A'); K.D.isDown = cur.includes('D'); K.W.isDown = cur.includes('W'); K.S.isDown = cur.includes('S');
      if (i === 200) {
        if (set !== 'p2a') gs.weaponPickups.push(new window.__WP(gs, P.x, P.y, 'rifle'));   // a real OVERRIDE module, collected
        else { P.secondary = 'rifle'; P.secondaryAmmo = 90; gs.events.emit('secondary-equipped', 'rifle'); }
      }
      if (i >= 10 && i % 6 === 0) P.keyboardFire();
      window.__adv(1);
      return window.__state();
    }, { i, seg, set: SET });
    hashes.push(fnv(s));
    // every other tick: a 30 fps film of a 60 Hz fight
    if (dir && i % EVERY === 0) await p.screenshot({ path: `${dir}/f${String(i / EVERY).padStart(3, '0')}.png` });
  }
  await p.close();
  return hashes;
}

const firstDiff = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) return i; return -1; };
const log = [];
const say = (s) => { console.log(s); log.push(s); };
mkdirSync(OUT, { recursive: true });
const TMP = opt('frames', `${OUT}/.frames`);   // raw frames (not evidence: keep them out of the repo)

for (const name of Object.keys(SCENE_SET)) {
  if (!want(name)) continue;
  rmSync(`${TMP}/${name}`, { recursive: true, force: true });
  const hA = await stage(A, name, `${TMP}/${name}/A`);
  const hB = await stage(B, name, `${TMP}/${name}/B`);
  const d = firstDiff(hA, hB);
  say(`${name}: ${hA.length} ticks, A vs B gameplay state ${d < 0 ? 'IDENTICAL at every tick' : `DIFFERS at tick ${d}`}`);
  if (d >= 0) continue;
  const dir = `${OUT}/${name}`; mkdirSync(dir, { recursive: true });
  const S = SCENE_SET[name];
  const crop = !!(S.rect || S.screen), FPS = S.step ? Math.round(1000 / S.step) : 60;
  // frame sheets: A row over B row, every tick, 2x nearest
  const n = hA.length, cols = Math.min(n, 10);
  for (const [lab, sub] of (crop ? [['A', 'A'], ['B', 'B']] : [])) {   // full-frame scenes: the phone strip + film instead
    sh(`ffmpeg -y -loglevel error -framerate 60 -i ${TMP}/${name}/${sub}/f%03d.png -vf "tile=${cols}x${Math.ceil(n / cols)}:padding=4:color=0x202020" -frames:v 1 ${dir}/sheet-${lab}.png`);
    sh(`python3 -c "from PIL import Image; Image.open('${dir}/sheet-${lab}.png').convert('RGB').save('${dir}/sheet-${lab}.png', optimize=True)"`);
  }
  // full-frame scenes: A | B films at PHONE SIZE (390px each), and the key stills
  if (!crop) sh(`ffmpeg -y -loglevel error -framerate 60 -i ${TMP}/${name}/A/f%03d.png -framerate 60 -i ${TMP}/${name}/B/f%03d.png -filter_complex "[0]scale=390:-2:flags=area,pad=iw+8:ih:0:0:0x202020[a];[1]scale=390:-2:flags=area[b];[a][b]hstack,format=yuv420p" -c:v libx264 -crf 23 ${dir}/ab-phone-size.mp4`);
  for (const k of S.full || []) {
    sh(`python3 -c "
from PIL import Image
a=Image.open('${TMP}/${name}/A/full%03d.png'%${k}); b=Image.open('${TMP}/${name}/B/full%03d.png'%${k})
W=390; H=int(a.size[1]*W/a.size[0])
o=Image.new('RGB',(W*2+8,H),(20,20,20)); o.paste(a.resize((W,H),Image.LANCZOS),(0,0)); o.paste(b.resize((W,H),Image.LANCZOS),(W+8,0))
o.save('${dir}/ab-phone-full-%03d.png'%${k}, optimize=True)
"`);
  }
  // A | B per tick at TWICE PHONE SCALE (the canvas shows at ~0.54x on a
  // 390px-wide phone; x1.08 keeps the A:B comparison honest and inspectable)
  sh(`python3 -c "
from PIL import Image
idx=list(range(${S.strip[0]}, ${Math.min(S.strip[1], n)}, ${S.strip[2]})); fr=[(Image.open('${TMP}/${name}/A/f%03d.png'%i),Image.open('${TMP}/${name}/B/f%03d.png'%i)) for i in idx]; n=len(fr)
w,h=fr[0][0].size; k=${crop ? 1.08 : 0.3}; W,H=int(w*k),int(h*k)
o=Image.new('RGB',(W*2+8,(H+4)*n),(20,20,20))
for k,(a,b) in enumerate(fr):
  o.paste(a.resize((W,H),Image.LANCZOS),(0,k*(H+4))); o.paste(b.resize((W,H),Image.LANCZOS),(W+8,k*(H+4)))
o.save('${dir}/${crop ? 'ab-phone2x' : 'ab-phone-strip'}.png', optimize=True)
"`);
  // synchronized film, A | B, 2x, real time and 1/4 speed
  if (crop) {   // close-ups only: a full-frame scene has its phone-size film above
    sh(`ffmpeg -y -loglevel error -framerate ${FPS} -i ${TMP}/${name}/A/f%03d.png -framerate ${FPS} -i ${TMP}/${name}/B/f%03d.png -filter_complex "[0]scale=iw*2:ih*2:flags=neighbor,pad=iw+8:ih:0:0:0x202020[a];[1]scale=iw*2:ih*2:flags=neighbor[b];[a][b]hstack,format=yuv420p,scale=trunc(iw/2)*2:trunc(ih/2)*2" -c:v libx264 -crf 18 ${dir}/ab-${FPS}fps.mp4`);
    sh(`ffmpeg -y -loglevel error -i ${dir}/ab-${FPS}fps.mp4 -vf "setpts=4*PTS" -r 30 -c:v libx264 -crf 18 ${dir}/ab-quarter-speed.mp4`);
    // the p2a3 sets: the same crop at TRUE phone size (the canvas shows at 0.54x on a 390pt-wide phone)
    if (SET.startsWith('p2a3')) sh(`ffmpeg -y -loglevel error -framerate ${FPS} -i ${TMP}/${name}/A/f%03d.png -framerate ${FPS} -i ${TMP}/${name}/B/f%03d.png -filter_complex "[0]scale=trunc(iw*0.54/2)*2:-2:flags=area,pad=iw+8:ih:0:0:0x202020[a];[1]scale=trunc(iw*0.54/2)*2:-2:flags=area[b];[a][b]hstack,format=yuv420p,scale=trunc(iw/2)*2:trunc(ih/2)*2" -c:v libx264 -crf 18 ${dir}/ab-phone-1x-${FPS}fps.mp4`);
  }
}

for (const name of Object.keys(FIGHTS)) {
  if (!want(name)) continue;
  rmSync(`${TMP}/${name}`, { recursive: true, force: true });
  const hA = await fight(A, name, `${TMP}/${name}/A`);
  const hB = await fight(B, name, `${TMP}/${name}/B`);
  const d = firstDiff(hA, hB);
  say(`${name}: ${hA.length} ticks, A vs B gameplay state ${d < 0 ? 'IDENTICAL at every tick' : `DIFFERS at tick ${d}`}`);
  if (d >= 0) continue;
  const dir = `${OUT}/${name}`; mkdirSync(dir, { recursive: true });
  // phone size: the canvas at 390 CSS px (0.54x), A | B
  sh(`ffmpeg -y -loglevel error -framerate ${60 / EVERY} -i ${TMP}/${name}/A/f%03d.png -framerate ${60 / EVERY} -i ${TMP}/${name}/B/f%03d.png -filter_complex "[0]scale=390:-2:flags=area,pad=iw+8:ih:0:0:0x202020[a];[1]scale=390:-2:flags=area[b];[a][b]hstack,format=yuv420p" -c:v libx264 -crf 23 ${dir}/ab-phone-size.mp4`);
  sh(`ffmpeg -y -loglevel error -framerate ${60 / EVERY} -i ${TMP}/${name}/B/f%03d.png -vf "scale=540:-2:flags=area,format=yuv420p" -c:v libx264 -crf 23 ${dir}/b-540.mp4`);
  // key frames, A | B at phone size (390px wide each)
  for (const k of [20, 40, 60, 75, 100, 118, 150, 180].map((f) => (f * 2) / EVERY)) {   // the same TICKS (40..360) whatever the film rate
    sh(`python3 -c "
from PIL import Image
a=Image.open('${TMP}/${name}/A/f%03d.png'%${k}); b=Image.open('${TMP}/${name}/B/f%03d.png'%${k})
W=390; H=int(a.size[1]*W/a.size[0])
o=Image.new('RGB',(W*2+8,H),(20,20,20)); o.paste(a.resize((W,H),Image.LANCZOS),(0,0)); o.paste(b.resize((W,H),Image.LANCZOS),(W+8,0))
o.save('${dir}/ab-phone-%03d.png'%${k}, optimize=True)
"`);
  }
}
writeFileSync(`${OUT}/shot-p2a.txt`, log.join('\n') + '\n');
await browser.close();
