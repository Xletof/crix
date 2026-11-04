// EVIDENCE — VISUAL IDENTITY V2 (`?visualPilot=v2`), matched A/B frames.
//
//   node tests/shot-visual-pilot.mjs [--out=DIR] [--configs=A,B] [--ticks=150,300,...] [--seed=N]
//
// ONE FIGHT, PHOTOGRAPHED TWICE. Both halves boot the same seeded page
// (`bootPage`: Math.random replaced by a counted LCG, Date.now pinned, the loop
// stepped by hand at 60Hz), run the same SWARM TIDE encounter in the Hangar with
// the same scripted player, and stage the same four darker archetypes at the
// same tick. The pilot is presentation only, so the two halves are the same
// fight tick for tick — the rig CHECKS that at every shutter (player position,
// every enemy's position and hp, the bullet count and the RNG draw count) and
// refuses to write a pair that is not.
//
// Configs (exact URL flags, sent WITHOUT a baseline pin: the no-flags page is
// the R1 production game); `--configs=A,B,C` (default) picks which run, and
// every later one is checked against the first:
//   A  ''                  current R1 production presentation
//   B  'visualPilot=v2'    the Visual Identity V2 candidate (as delivered)
//   C  'visualPilot=v2b'   the V2B candidate: V2's characters, the refined Hangar
//   D  'visualPilot=v2c'   the V2C candidate: V2B with a new Hangar ground
// `--stage=lane` (default) or `apron` picks the staged fight (below).
//
// `--mode=env` photographs the EMPTY Hangar instead (no enemies, HUD hidden)
// at four player stations — apron, lane, staging bay, east freight — each
// after 90 ticks for the camera to settle: `env-<station>-<cfg>.png`.
//
// `--mode=film [--from=60 --to=420 --every=2]` films the same staged fight as
// a frame sequence, `film/<cfg>-<nnnn>.png`, every frame state-checked A vs B
// like a shutter (a film that is not the same fight is refused); assemble
// with ffmpeg (docs/evidence/visual-identity-v2/README.md has the line).
//
// `--mode=lineup` stands the cast in two rows on the empty Hangar deck — two
// swarmlings, the hero, a Rifleman; Gunner, Marksman, Bulwark, Demolisher — rendered
// by the game at real scale (`lineup-<cfg>.png`), HUD hidden.
//
// Each shutter writes `<tick>-<cfg>.png` at the real 720x1280 canvas size —
// the canvas a phone scales to its screen (about 0.54x on a 390pt-wide
// handset). The HUD is left on: it is part of what the player sees.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { bootPage, CHROME } from './diag-stuck-audit.mjs';

const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const OUT = opt('out', 'docs/evidence/visual-identity-v2/ab');
const SEED = +opt('seed', '7311');
const TICKS = opt('ticks', '90,180,300,400,480,560,660').split(',').map(Number);
const CONFIGS = { A: '', B: 'visualPilot=v2', C: 'visualPilot=v2b', D: 'visualPilot=v2c' };
const RUN = opt('configs', 'A,B,C').split(',');
const Q = opt('q', 'room=hangar');
const MODE = opt('mode', 'fight');
const FILM = { from: +opt('from', '60'), to: +opt('to', '420'), every: +opt('every', '2') };
const STATIONS = { apron: [430, 650], lane: [800, 700], bay: [1010, 1000], east: [1240, 470] };
mkdirSync(OUT, { recursive: true });

// The player's route: a walk east along the deployment lane, a turn north
// towards the apron, south through the lane, then a strafe — so every facing
// and the walk cycle are on film. Fires on a fixed cadence.
const SEG_LANE = [[0, 50, ''], [50, 150, 'D'], [150, 200, 'W'], [200, 260, 'DW'], [260, 360, 'S'], [360, 440, 'A'], [440, 520, 'DS'], [520, 600, 'W'], [600, 99999, 'D']];

// THE COMPOSITION, staged at fixed ticks and spots so both halves get it
// identically: the brief's cast in one Hangar fight. Swarm packs are the real
// `_spawnSwarmlingPack` (pack size and offsets drawn from the gameplay RNG).
const STAGE_LANE = {
  0: [['pack', 820, 560], ['grunt', 900, 700], ['grunt', 860, 860], ['grunt', 1040, 640]],
  20: [['shooter', 1120, 560], ['sniper', 1240, 900], ['shielded', 1000, 900], ['bomber', 1100, 420]],
  220: [['pack', 1180, 760]],
  420: [['pack', 700, 980], ['grunt', 1000, 1000]],
};

// `--stage=apron`: the same cast staged on the launch apron and the gantry —
// a dark Gunner beside the consoles, a Bulwark by the gantry, swarm packs round
// the shuttle — so dark enemies are photographed against dark machinery.
const SEG_APRON = [[0, 60, ''], [60, 140, 'S'], [140, 220, 'D'], [220, 300, 'W'], [300, 380, 'A'], [380, 460, 'S'], [460, 540, 'D'], [540, 99999, 'W']];
const STAGE_APRON = {
  0: [['pack', 540, 820], ['grunt', 620, 760], ['grunt', 300, 900]],
  20: [['shooter', 700, 560], ['shielded', 560, 980], ['sniper', 780, 1010], ['bomber', 720, 660]],
  220: [['pack', 340, 800]],
  420: [['pack', 620, 980], ['grunt', 500, 1000]],
};
const STAGES = { lane: { seg: SEG_LANE, stage: STAGE_LANE, start: [560, 720] }, apron: { seg: SEG_APRON, stage: STAGE_APRON, start: [430, 720] } };
const ST = STAGES[opt('stage', 'lane')];
const SEG = ST.seg, STAGE = ST.stage;

async function run(browser, cfg, ticks = TICKS, name = (t, c) => `${t}-${c}.png`) {
  const page = await bootPage(browser, { flags: CONFIGS[cfg], baseline: null, q: Q, seed: SEED });
  const frames = [];
  const last = Math.max(...ticks);
  await page.evaluate(({ seed, start }) => {
    const gs = window.__gs;
    // Same room modifier in both halves, and none: a DARKNESS roll would
    // photograph the modifier rather than the art.
    // No wave spawner: the composition is staged below.
    gs.arenaActive = false;
    gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
    gs._roomModifier = null;
    if (gs.arenaCfg) gs.arenaCfg = { ...gs.arenaCfg, speedMult: undefined };
    gs.events.emit('modifier-active', null, null);
    gs.events.emit('set-darkness', false);
    gs.player.setPosition(start[0], start[1]); gs.player.setVelocity(0, 0);
    window.__seed(seed); window.__draws = 0; window.__tick = 0;
    window.__state = () => {
      const r = (v) => Math.round(v * 100) / 100;
      const es = gs.enemies.getChildren().filter((e) => e.active).map((e) => [e.enemyType, r(e.x), r(e.y), Math.round(e.hp)]);
      let nb = 0; for (const g of gs.hostileBullets || []) nb += g.countActive?.(true) ?? 0;
      nb += gs.playerBullets?.countActive?.(true) ?? 0;
      return JSON.stringify({ p: [r(gs.player.x), r(gs.player.y)], es, nb, d: window.__draws });
    };
  }, { seed: SEED, start: ST.start });
  let t = 0;
  for (const target of [...ticks].sort((a, b) => a - b)) {
    await page.evaluate(({ from, to, seg, stage }) => {
      const gs = window.__gs, P = gs.player, K = gs.keys;
      for (let i = from; i < to; i++) {
        const cur = seg.find(([a, b]) => i >= a && i < b)[2];
        K.A.isDown = cur.includes('A'); K.D.isDown = cur.includes('D'); K.W.isDown = cur.includes('W'); K.S.isDown = cur.includes('S');
        if (i >= 40 && i % 9 === 0) P.keyboardFire();
        for (const [what, x, y] of stage[i] || []) {
          if (what === 'pack') gs._spawnSwarmlingPack(x, y); else gs.spawnEnemyAt(what, x, y, {});
        }
        window.__adv(1);
      }
    }, { from: t, to: target, seg: SEG, stage: STAGE });
    t = target;
    const state = await page.evaluate(() => {
      const gs = window.__gs;
      return window.__state();
    });
    // one more rendered frame with FX reset, then the shutter (the step is the
    // same in both halves, so it is part of the fight, not outside it)
    // (a film keeps the real presentation: banners, flashes and shake stay in)
    await page.evaluate((film) => {
      const gs = window.__gs, hud = window.game.scene.getScene('HUD');
      if (!film) {
        if (hud?.banner) { hud.tweens?.killTweensOf?.(hud.banner); hud.banner.setAlpha(0); }
        gs.cameras.main.resetFX();
      }
      gs._sectorTint?.setAlpha(0);
      window.__adv(1);
    }, MODE === 'film');
    t += 1;
    const png = await page.screenshot();
    writeFileSync(`${OUT}/${name(target, cfg)}`, png);
    frames.push({ tick: target, state });
    if (target === last) break;
  }
  await page.close();
  return frames;
}

async function runEnv(browser, cfg) {
  const page = await bootPage(browser, { flags: CONFIGS[cfg], baseline: null, q: Q, seed: SEED });
  const frames = [];
  await page.evaluate(({ seed }) => {
    const gs = window.__gs;
    gs.arenaActive = false;
    gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
    gs._roomModifier = null;
    gs.events.emit('modifier-active', null, null);
    gs.events.emit('set-darkness', false);
    window.game.scene.getScene('HUD').sys.setVisible(false);
    window.__seed(seed); window.__draws = 0;
  }, { seed: SEED });
  for (const [name, [x, y]] of Object.entries(STATIONS)) {
    const state = await page.evaluate(([x, y]) => {
      const gs = window.__gs;
      gs.player.setPosition(x, y); gs.player.setVelocity(0, 0);
      window.__adv(90);
      gs.cameras.main.resetFX(); gs._sectorTint?.setAlpha(0);
      window.__adv(1);
      const c = gs.cameras.main;
      return JSON.stringify({ p: [gs.player.x, gs.player.y], scroll: [Math.round(c.scrollX * 100) / 100, Math.round(c.scrollY * 100) / 100], d: window.__draws });
    }, [x, y]);
    writeFileSync(`${OUT}/env-${name}-${cfg}.png`, await page.screenshot());
    frames.push({ tick: name, state });
  }
  // LIGHTS OUT at the lane station, forced to full darkness with no tween
  // (shot-dark-arena's recipe), HUD back on for its blackout overlay.
  const dstate = await page.evaluate(() => {
    const gs = window.__gs, hud = window.game.scene.getScene('HUD');
    gs.player.setPosition(800, 700); gs.player.setVelocity(0, 0);
    window.__adv(90);
    hud.sys.setVisible(true);
    gs._enterDarkArena();
    gs._darkChain?.stop?.();
    gs._darkMix.v = 1; gs._applyDarkMix();
    hud.setDarkness(true, 'blackout');
    hud._darkTweens?.blackout?.stop?.();
    hud._overlays?.blackout?.setAlpha(1);
    if (hud?.banner) { hud.tweens?.killTweensOf?.(hud.banner); hud.banner.setAlpha(0); }
    gs.cameras.main.resetFX(); gs._sectorTint?.setAlpha(0);
    window.__adv(1);
    return JSON.stringify({ p: [gs.player.x, gs.player.y], d: window.__draws });
  });
  writeFileSync(`${OUT}/env-dark-${cfg}.png`, await page.screenshot());
  frames.push({ tick: 'dark', state: dstate });
  await page.close();
  return frames;
}

async function runLineup(browser, cfg) {
  const page = await bootPage(browser, { flags: CONFIGS[cfg], baseline: null, q: Q, seed: SEED });
  const state = await page.evaluate(({ seed }) => {
    const gs = window.__gs;
    gs.arenaActive = false;
    gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
    gs._roomModifier = null;
    gs.events.emit('modifier-active', null, null);
    window.game.scene.getScene('HUD').sys.setVisible(false);
    window.__seed(seed); window.__draws = 0;
    gs.player.setPosition(700, 760); gs.player.setVelocity(0, 0);
    window.__adv(90);
    const row = [['swarmling', 592, 770], ['swarmling', 644, 770], ['grunt', 790, 760],
      ['shooter', 600, 880], ['sniper', 680, 880], ['shielded', 774, 880], ['bomber', 866, 880]];
    for (const [t, x, y] of row) {
      const e = gs.spawnEnemyAt(t, x, y, {});
      e.setVelocity(0, 0);            // two ticks later they have barely started towards the player
    }
    gs.player.setPosition(700, 760);
    window.__adv(2);
    gs.cameras.main.resetFX(); gs._sectorTint?.setAlpha(0);
    window.__adv(1);
    return JSON.stringify({ d: window.__draws, n: gs.enemies.getChildren().length });
  }, { seed: SEED });
  writeFileSync(`${OUT}/lineup-${cfg}.png`, await page.screenshot());
  await page.close();
  return [{ tick: 'lineup', state }];
}

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const res = {};
if (MODE === 'film') mkdirSync(`${OUT}/film`, { recursive: true });
const filmTicks = [];
for (let t = FILM.from; t <= FILM.to; t += FILM.every) filmTicks.push(t);
for (const c of RUN) {
  res[c] = MODE === 'env' ? await runEnv(browser, c)
    : MODE === 'lineup' ? await runLineup(browser, c)
    : MODE === 'film' ? await run(browser, c, filmTicks, (t, cc) => `film/${cc}-${String((t - FILM.from) / FILM.every).padStart(4, '0')}.png`)
    : await run(browser, c);
  console.log(`${c}: ${res[c].length} frames`);
}
await browser.close();
let ok = true;
// every other configuration is checked against the FIRST one run, frame by frame
const [ref, ...rest] = RUN;
for (const c of rest) {
  for (let i = 0; i < res[ref].length; i++) {
    const same = res[ref][i].state === res[c][i]?.state;
    if (!same) ok = false;
    if (MODE !== 'film' || !same) console.log(`${ref}/${c} tick ${res[ref][i].tick}: ${same ? 'SAME FIGHT' : 'DIVERGED'}  ${same ? '' : `\n  ${ref} ${res[ref][i].state}\n  ${c} ${res[c][i]?.state}`}`);
  }
}
if (MODE === 'film') console.log(`film: ${res[ref]?.length ?? 0} frames per config, ${ok ? 'every frame the same fight' : 'NOT the same fight'}`);
writeFileSync(`${OUT}/states-${MODE}.json`, JSON.stringify(res, null, 1));
process.exit(ok ? 0 : 1);
