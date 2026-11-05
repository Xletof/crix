// EVIDENCE — P1 COMBAT VISUAL POLISH (`?visualPilot=v2c&polish=p1`), matched A/B.
//
//   node tests/shot-polish-p1.mjs --mode=banners|sheet|super|film|phone [--out=DIR]
//
// A = `visualPilot=v2c` (the approved V2C baseline), B = `visualPilot=v2c&polish=p1`.
// Both halves boot the same seeded page (`bootPage`: counted LCG, pinned clock,
// the loop stepped by hand at 60Hz) with NO baseline pin, so the gameplay
// underneath is the R1 production game in both.
//
//   banners  every announcement case the brief lists, P1 off and on, on the
//            full 720px canvas framed in magenta (anything cut by the frame is
//            cut on the phone): `banner-<case>-<A|B>-rest.png` (the held pose:
//            the pop tween finished) and `-peak.png` (the exit tween's end
//            geometry, scale 1.16, forced to full alpha — the widest the text
//            is ever drawn, shown as if it were opaque). Composite cases (combo
//            over a banner, the duel block, the sector sign, the medal lane)
//            run the real tweens for the stated number of ticks.
//   sheet    the weapon comparison: the same V2C hero in the same poses with the
//            shipped overlays (A) and the P1 weapons (B), `sheet-A.png`,
//            `sheet-B.png`, one 160px tile per pose, 3x nearest-neighbour.
//   super    the Super state cycle under P1 (and the shipped one under A):
//            ordinary, charging, ready, the ready ping, Super fired, spent,
//            shield + ready, hit flash + ready, suppressed + ready, crowd.
//   film     one SWARM TIDE fight in the Hangar, filmed in both halves, every
//            frame state-checked A vs B (a film that is not the same fight is
//            refused): the hero fires, the Super charges and is ready, a banner
//            arrives, the Super is fired, the fight goes on with the rifle.
//            `film/<A|B>-<nnnn>.png`.
//   phone    the same cases on a 390x844 CSS-px portrait viewport (the canvas
//            FIT to 390px, ~0.54x, as a phone shows it): `phone-<case>-<A|B>.png`.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { bootPage, CHROME } from './diag-stuck-audit.mjs';

const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const OUT = opt('out', 'docs/evidence/combat-visual-polish-p1');
const MODE = opt('mode', 'banners');
const CONFIGS = { A: 'visualPilot=v2c', B: 'visualPilot=v2c&polish=p1' };
const SEED = +opt('seed', '7311');
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const sh = (c) => execSync(c, { stdio: 'pipe' }).toString();

async function boot(cfg, { q = 'room=hangar', viewport } = {}) {
  const p = await bootPage(browser, { flags: CONFIGS[cfg], baseline: null, q, seed: SEED, viewport });
  await p.evaluate(() => {
    const gs = window.__gs;
    gs.arenaActive = false; gs._spawnQueue = [];
    gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
    gs._roomModifier = null;
    gs.events.emit('modifier-active', null, null);
    gs.events.emit('set-darkness', false);
    gs.player.setPosition(760, 980); gs.player.setVelocity(0, 0);
    const hud = window.game.scene.getScene('HUD');
    window.__hud = hud;
    window.__quiet = () => {        // no banner / combo / medal / sign / duel on screen
      if (gs.doorZone) { gs.doorZone.destroy(); gs.doorZone = null; }
      for (const o of [hud.banner, hud.comboText, hud._medalText]) if (o?.active) { hud.tweens.killTweensOf(o); o.setAlpha(0); }
      hud.hideSectorSign(); hud.endDuel();
      gs.cameras.main.resetFX(); gs._sectorTint?.setAlpha(0);
    };
    // let the room's own scheduled announcements (WAVE, the modifier at
    // 1.55s, the terminal hint at up to 3.1s) fire and fade before staging
    window.__adv(260);
    window.__quiet();
  });
  return p;
}

// ── banners ────────────────────────────────────────────────────────────────
const BANNERS = [
  ['sector', 'SECTOR 3', '#ffbb40'],
  ['slice', 'SLICE TERMINALS FOR SUPPORT', '#ffd040'],
  ['detected', '⚠ DETECTED', '#ff2828'],
  ['frenzy', 'FRENZY', '#ff5030'],
  ['waveclear', 'WAVE CLEAR!', '#20ff60'],
  ['chamber', 'CHAMBER CLEAR', '#20ff60'],
  ['finish', 'ARENA SURVIVED — FINISH THEM!', '#20ff60'],
  ['support', 'SUPPORT: SHIELD CHARGED & BACTA VIAL', '#40ff80'],
  ['darklord', 'SECTOR 10 — DARK LORD', '#ff2828'],
  ['vader', 'VADER APPROACHES', '#ff2828'],
];
// composites: [id, staging fn source, ticks to run]
const COMPOSITES = [
  ['combo', `hud.showBanner('MULTIKILL', '#ff8020'); hud.showCombo(12);`, 16],
  ['combo-stack', `hud.showBanner('SLICE TERMINALS FOR SUPPORT', '#ffd040'); hud.showCombo(7);`, 16],
  ['duel', `const e = gs.spawnEnemyAt('shooter', 980, 900, {}); e._miniBoss = true; e._nemesis = { name: 'Vosk the Unbroken', tint: '#ffb020' }; hud.startDuel(e); window.__adv(2); hud.showBanner('SWEEPING BARRAGE', '#ffb020');`, 16],
  ['duel-long', `const e = gs.spawnEnemyAt('shooter', 980, 900, {}); e._miniBoss = true; e._nemesis = { name: 'Vosk the Unbroken', tint: '#ffb020' }; hud.startDuel(e); window.__adv(2); hud.showBanner('SUPPORT: SHIELD CHARGED & BACTA VIAL', '#40ff80');`, 16],
  // the real exit: `_openDoor` gives the HUD's per-frame driver an open door,
  // and the driver raises the sign exactly as a cleared room does
  ['sign-slam', `gs.sector = 7; gs.runKills = 143; gs._roomKillsAtStart = 0; gs._openDoor();`, 2],
  ['sign', `gs.sector = 7; gs.runKills = 143; gs._roomKillsAtStart = 0; gs._openDoor();`, 40],
  ['sign-banner', `gs.sector = 7; gs.runKills = 143; gs._roomKillsAtStart = 0; gs._openDoor(); window.__adv(40); hud.showBanner('MULTIKILL', '#ff8020'); hud.showCombo(5);`, 16],
  ['sign-medal', `gs.sector = 7; gs.runKills = 143; gs._roomKillsAtStart = 0; gs._openDoor(); window.__adv(40); hud.showBanner('ARENA SURVIVED — FINISH THEM!', '#20ff60'); hud.showMedal('ARENA CLEAR', 2500, '#20ff60');`, 16],
  ['medal', `hud.showMedal('SUPPRESSED — he takes the power, not the gun', 0, '#ff5050');`, 14],
  ['wave-medal', `hud.showBanner('WAVE CLEAR!', '#20ff60'); hud.showMedal('FLAWLESS', 1200, '#90d8ff');`, 14],
];
const frame = (f) => sh(`convert ${f} -crop 720x560+0+0 +repage -bordercolor '#ff00ff' -border 6 ${f}`);

async function banners() {
  const pages = { A: await boot('A'), B: await boot('B') };
  for (const [id, text, col] of BANNERS) {
    for (const cfg of ['A', 'B']) {
      const p = pages[cfg];
      await p.evaluate(({ text, col }) => { window.__quiet(); window.__hud.showBanner(text, col); window.__adv(16); window.__hud.tweens.killTweensOf(window.__hud.banner); window.__hud.banner.setAlpha(1).setScale(1.05); window.__adv(1); }, { text, col });
      await p.screenshot({ path: `${OUT}/banner-${id}-${cfg}-rest.png` }); frame(`${OUT}/banner-${id}-${cfg}-rest.png`);
      await p.evaluate(() => { window.__hud.banner.setAlpha(1).setScale(1.16); window.__adv(1); });
      await p.screenshot({ path: `${OUT}/banner-${id}-${cfg}-peak.png` }); frame(`${OUT}/banner-${id}-${cfg}-peak.png`);
    }
  }
  for (const [id, src, ticks] of COMPOSITES) {
    for (const cfg of ['A', 'B']) {
      const p = pages[cfg];
      await p.evaluate(({ src, ticks }) => {
        const gs = window.__gs, hud = window.__hud;
        window.__quiet();
        new Function('gs', 'hud', src)(gs, hud);
        window.__adv(ticks);
        gs.cameras.main.resetFX(); window.__adv(1);
      }, { src, ticks });
      await p.screenshot({ path: `${OUT}/banner-${id}-${cfg}.png` }); frame(`${OUT}/banner-${id}-${cfg}.png`);
      await p.evaluate(() => { const gs = window.__gs; window.__quiet(); gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e)); window.__adv(2); });
    }
  }
  // the A|B pairs, side by side
  const ids = [...BANNERS.flatMap(([id]) => [`${id}-%s-rest`, `${id}-%s-peak`]), ...COMPOSITES.map(([id]) => `${id}-%s`)];
  for (const pat of ids) {
    const a = `${OUT}/banner-${pat.replace('%s', 'A')}.png`, b = `${OUT}/banner-${pat.replace('%s', 'B')}.png`;
    sh(`montage -label 'A  V2C' ${a} -label 'B  V2C + P1' ${b} -tile 2x1 -geometry +8+8 -background '#111' -fill white -pointsize 22 ${OUT}/ab-banner-${pat.replace('-%s', '')}.png`);
  }
  for (const p of Object.values(pages)) await p.close();
}

// ── the weapon sheet ───────────────────────────────────────────────────────
const D = Math.PI / 180;
const POSES = [
  ['idle front', { aim: 90 * D }], ['idle back', { aim: -90 * D }], ['idle east', { aim: 0 }], ['idle west', { aim: 180 * D }],
  ['aim SE', { aim: 40 * D }], ['aim NE', { aim: -40 * D }], ['aim SW', { aim: 140 * D }], ['aim NW', { aim: -140 * D }],
  ['pistol fire', { aim: 0, fire: 1 }], ['pistol recoil', { aim: 0, fire: 1, kick: 70 }], ['pistol fire S', { aim: 90 * D, fire: 1 }], ['walk east', { aim: null, walk: 1 }],
  ['rifle east', { aim: 0, rifle: 1 }], ['rifle front', { aim: 90 * D, rifle: 1 }], ['rifle back', { aim: -90 * D, rifle: 1 }], ['rifle fire', { aim: 0, rifle: 1, fire: 1 }],
  ['rifle NW', { aim: -140 * D, rifle: 1 }], ['melee wind-up', { aim: 0, melee: 1, mp: 0.08 }], ['melee swing', { aim: 0, melee: 1, mp: 0.5 }], ['melee swing 2', { aim: 0, melee: 2, mp: 0.55 }],
  ['melee finisher', { aim: 0, melee: 3, mp: 0.35 }], ['melee S', { aim: 90 * D, melee: 1, mp: 0.5 }], ['super ready', { aim: 0, super: 1 }], ['rifle + super', { aim: -40 * D, rifle: 1, super: 1 }],
];
async function installPose(p) {
  await p.evaluate(() => {
    const gs = window.__gs, P = gs.player;
    window.__pose = (o) => {
      P.setPosition(o.x ?? 760, o.y ?? 980); P.body.reset(o.x ?? 760, o.y ?? 980);
      P.aiming = o.aim != null; if (o.aim != null) P.aim = o.aim;
      P.secondary = o.rifle ? 'rifle' : null; if (o.rifle) P.secondaryAmmo = 30;
      P.superCharge = o.super ? 99 : (o.charge ?? 0);
      P.shieldHp = o.shield ? 100 : 0;
      P._meleeAnimT = 0; P._meleeAnimStage = 0;
      if (o.walk) { P.facing = 0; P.setMoveInput({ x: 1, y: 0, force: 1 }); window.__adv(18); }
      else window.__adv(o.settle ?? 24);
      if (o.fire) { P._fireAnimTimer = 140; P._wKickT = o.kick ?? 40; P._wKickDur = 80; P._wKickMag = o.rifle ? 5.25 : 7; }
      if (o.melee) { P._meleeAnimDur = 300; P._meleeAnimT = 300 * (1 - (o.mp ?? 0.4)); P._meleeAnimStage = o.melee; }
      window.__adv(1);
      P.setMoveInput({ x: 0, y: 0, force: 0 });
      const cam = gs.cameras.main, vw = cam.worldView;
      return { sx: cam.x + (P.x - vw.x) * cam.zoom, sy: cam.y + (P.y - vw.y) * cam.zoom };
    };
  });
}
async function sheet() {
  const files = { A: [], B: [] };
  for (const cfg of ['A', 'B']) {
    const p = await boot(cfg);
    await installPose(p);
    let i = 0;
    for (const [name, o] of POSES) {
      const r = await p.evaluate((o) => window.__pose(o), o);
      const f = `${OUT}/sheet/${cfg}-${String(i++).padStart(2, '0')}.png`;
      mkdirSync(`${OUT}/sheet`, { recursive: true });
      await p.screenshot({ path: f, clip: { x: Math.round(r.sx - 80), y: Math.round(r.sy - 80), width: 160, height: 160 } });
      sh(`convert ${f} -filter point -resize 300% ${f}`);
      files[cfg].push([name, f]);
    }
    await p.close();
  }
  for (const cfg of ['A', 'B']) {
    sh(`montage ${files[cfg].map(([n, f]) => `-label '${n}' ${f}`).join(' ')} -tile 6x -geometry +4+4 -background '#161616' -fill white -pointsize 24 ${OUT}/sheet-${cfg}.png`);
  }
  // matched pairs, one row per pose group: A over B
  const pairs = files.A.map(([n, f], k) => `-label '${n}  A' ${f} -label '${n}  B' ${files.B[k][1]}`);
  sh(`montage ${pairs.join(' ')} -tile 8x -geometry +4+4 -background '#161616' -fill white -pointsize 22 ${OUT}/sheet-AB.png`);
}

// ── the Super cycle ────────────────────────────────────────────────────────
async function superCycle() {
  const steps = [
    ['1-ordinary', `P.superCharge = 0;`, 30],
    ['2-charging-25', `P.superCharge = 1;`, 30],
    ['3-charging-75', `P.superCharge = 3;`, 30],
    ['4-ready-ping', `P.superCharge = 4;`, 6],
    ['5-ready', ``, 40],
    ['6-ready-beat', ``, 13],
    ['7-super-fired', `P.aiming = true; P.aim = -0.4; P.tryFireSuper(-0.4);`, 5],
    ['8-spent', ``, 30],
    ['9-shield-ready', `P.superCharge = 4; P.shieldHp = 100;`, 30],
    ['10-hitflash-ready', `P.shieldHp = 0; gs.fx?.hitFlash?.(P);`, 1],
    ['11-suppressed-ready', `P._suppressedMs = 5000;`, 30],
    ['12-crowd-ready', `P._suppressedMs = 0; for (const [t, x, y] of [['grunt', 640, 900], ['shooter', 880, 860], ['bomber', 700, 1080], ['grunt', 860, 1060]]) gs.spawnEnemyAt(t, x, y, {}); gs._spawnSwarmlingPack(620, 1020);`, 50],
  ];
  mkdirSync(`${OUT}/super`, { recursive: true });
  for (const cfg of ['A', 'B']) {
    const p = await boot(cfg);
    await p.evaluate(() => { const P = window.__gs.player; P.aiming = true; P.aim = Math.PI / 2; window.__adv(10); });
    for (const [id, src, ticks] of steps) {
      const r = await p.evaluate(({ src, ticks }) => {
        const gs = window.__gs, P = gs.player;
        new Function('gs', 'P', src)(gs, P);
        window.__adv(ticks);
        gs.cameras.main.resetFX();
        const cam = gs.cameras.main, vw = cam.worldView;
        return { sx: cam.x + (P.x - vw.x) * cam.zoom, sy: cam.y + (P.y - vw.y) * cam.zoom };
      }, { src, ticks });
      const f = `${OUT}/super/${cfg}-${id}.png`;
      await p.screenshot({ path: f, clip: { x: Math.round(r.sx - 150), y: Math.round(r.sy - 150), width: 300, height: 300 } });
      sh(`convert ${f} -filter point -resize 200% ${f}`);
    }
    await p.close();
    sh(`montage ${steps.map(([id]) => `-label '${id}' ${OUT}/super/${cfg}-${id}.png`).join(' ')} -tile 6x -geometry +4+4 -background '#161616' -fill white -pointsize 22 ${OUT}/super-${cfg}.png`);
  }
}

// ── the integrated fight, filmed ───────────────────────────────────────────
// SWARM TIDE staged by hand in the Hangar (the same composition both halves);
// the hero strafes and fires; at tick 150 his Super meter is filled to the brim
// (a stand-in for the hits that would fill it, identical in both halves), a
// SLICE TERMINALS banner lands at 160 and FRENZY at 260, the Super is fired at
// 300, the rifle is picked up at 330 and fired to the end.
const SEG = [[0, 40, ''], [40, 120, 'D'], [120, 200, 'S'], [200, 260, 'A'], [260, 340, 'W'], [340, 420, 'D'], [420, 99999, 'S']];
const STAGE = {
  0: [['pack', 980, 860], ['grunt', 1040, 760], ['shooter', 1140, 980]],
  60: [['pack', 900, 1160], ['grunt', 1100, 1100]],
  220: [['pack', 1060, 820], ['shielded', 1180, 900]],
  360: [['pack', 820, 1160], ['grunt', 1000, 1180]],
};
async function film() {
  const from = +opt('from', '0'), to = +opt('to', '480'), every = +opt('every', '2');
  mkdirSync(`${OUT}/film`, { recursive: true });
  const pages = { A: await boot('A'), B: await boot('B') };
  for (const p of Object.values(pages)) {
    await p.evaluate(({ seed }) => {
      const gs = window.__gs;
      gs.player.setPosition(720, 960); gs.player.setVelocity(0, 0);
      window.__seed(seed); window.__draws = 0;
      window.__state = () => {
        const r = (v) => Math.round(v * 100) / 100;
        const es = gs.enemies.getChildren().filter((e) => e.active).map((e) => [e.enemyType, r(e.x), r(e.y), Math.round(e.hp)]);
        let nb = 0; for (const g of [...(gs.hostileBullets || []), gs.playerBullets, gs.playerRifleBullets, gs.playerSuperBullets]) nb += g?.countActive?.(true) ?? 0;
        return JSON.stringify({ p: [r(gs.player.x), r(gs.player.y), Math.round(gs.player.hp)], es, nb, d: window.__draws });
      };
    }, { seed: SEED });
  }
  let bad = 0;
  for (let t = 0; t < to; t++) {
    const st = {};
    for (const [cfg, p] of Object.entries(pages)) {
      st[cfg] = await p.evaluate(({ i, seg, stage }) => {
        const gs = window.__gs, P = gs.player, K = gs.keys, hud = window.__hud;
        const cur = seg.find(([a, b]) => i >= a && i < b)[2];
        K.A.isDown = cur.includes('A'); K.D.isDown = cur.includes('D'); K.W.isDown = cur.includes('W'); K.S.isDown = cur.includes('S');
        if (i >= 30 && i % 8 === 0) P.keyboardFire();
        for (const [what, x, y] of stage[i] || []) { if (what === 'pack') gs._spawnSwarmlingPack(x, y); else gs.spawnEnemyAt(what, x, y, {}); }
        if (i === 150) { P.superCharge = 99; gs.events.emit('player-super-ready'); }
        if (i === 160) gs.events.emit('show-banner', 'SLICE TERMINALS FOR SUPPORT', '#ffd040');
        if (i === 260) gs.events.emit('show-banner', 'FRENZY', '#ff5030');
        if (i === 300) P.tryFireSuper(P._autoAimAngle());
        if (i === 330) { P.secondary = 'rifle'; P.secondaryAmmo = 60; gs.events.emit('secondary-equipped', 'rifle'); }
        window.__adv(1);
        return window.__state();
      }, { i: t, seg: SEG, stage: STAGE });
    }
    if (st.A !== st.B) { bad++; if (bad < 3) console.log(`DIVERGED at tick ${t}`); }
    if (t >= from && (t - from) % every === 0) {
      for (const [cfg, p] of Object.entries(pages)) await p.screenshot({ path: `${OUT}/film/${cfg}-${String(t).padStart(4, '0')}.png` });
    }
  }
  for (const p of Object.values(pages)) await p.close();
  console.log(bad ? `REFUSED: ${bad} divergent ticks — not the same fight` : `film: ${to} ticks, A and B the same fight at every tick`);
  if (bad) process.exitCode = 1;
}

// ── phone size ─────────────────────────────────────────────────────────────
async function phone() {
  const vp = { width: 390, height: 844 };
  const cases = [
    ['slice', `hud.showBanner('SLICE TERMINALS FOR SUPPORT', '#ffd040');`, 16],
    ['support', `hud.showBanner('SUPPORT: SHIELD CHARGED & BACTA VIAL', '#40ff80');`, 16],
    ['combo', `hud.showBanner('MULTIKILL', '#ff8020'); hud.showCombo(12);`, 16],
    ['sign', `gs.sector = 7; gs.runKills = 143; gs._roomKillsAtStart = 0; gs._openDoor(); window.__adv(40); hud.showBanner('MULTIKILL', '#ff8020');`, 16],
    ['fight-ready', `P.superCharge = 99; P.aiming = true; P.aim = -0.5; for (const [t, x, y] of [['grunt', 640, 900], ['shooter', 880, 860], ['bomber', 700, 1080]]) gs.spawnEnemyAt(t, x, y, {}); gs._spawnSwarmlingPack(620, 1020); window.__adv(40); hud.showBanner('FRENZY', '#ff5030'); P._fireAnimTimer = 140; P._wKickT = 40;`, 12],
  ];
  for (const cfg of ['A', 'B']) {
    const p = await boot(cfg, { viewport: vp });
    for (const [id, src, ticks] of cases) {
      await p.evaluate(({ src, ticks }) => {
        const gs = window.__gs, hud = window.__hud, P = gs.player;
        window.__quiet();
        new Function('gs', 'hud', 'P', src)(gs, hud, P);
        window.__adv(ticks);
        gs.cameras.main.resetFX();
      }, { src, ticks });
      await p.screenshot({ path: `${OUT}/phone-${id}-${cfg}.png` });
      await p.evaluate(() => { const gs = window.__gs; window.__quiet(); gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e)); gs.player.superCharge = 0; window.__adv(2); });
    }
    await p.close();
  }
  for (const [id] of cases) sh(`montage -label 'A  V2C' ${OUT}/phone-${id}-A.png -label 'B  V2C + P1' ${OUT}/phone-${id}-B.png -tile 2x1 -geometry +8+8 -background '#111' -fill white -pointsize 18 ${OUT}/ab-phone-${id}.png`);
}

const run = { banners, sheet, super: superCycle, film, phone }[MODE];
if (!run) { console.error(`unknown --mode=${MODE}`); process.exit(2); }
await run();
await browser.close();
console.log(`wrote ${OUT}`);
