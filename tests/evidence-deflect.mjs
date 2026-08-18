// EVIDENCE RIG — photograph the DEFLECTION stance frame by frame.
//
// Not a test. It asserts nothing and gates nothing; it produces the pictures a
// human has to look at, because no assertion can certify that a parry looks
// like a parry. Three bugs in the last boss pass were found only by looking:
// a saber whose scale compounded 35% per throw, a stray telegraph, and a safe
// zone drawn in the danger colour.
//
// ── HOW IT GETS A TEMPORAL SEQUENCE OUT OF A ~20FPS HARNESS ────────────────
//
// A parry is 300ms, which is at best six frames here, and a screenshot takes
// far longer than a frame — so photographing the real curve as it happens gets
// you one arbitrary point of it and nothing about its shape.
//
// So the clock is SLOWED, not faked: `parryMs` is raised to 6s for the duration
// of the rig and `_parryT` is pinned to the fraction we want to see. Everything
// downstream is the production path — the same `parryPose`, the same weapon
// block in `Boss.preUpdate`, the same real deflection that requested it. It is
// a slow-motion camera pointed at the real thing, not a reconstruction.
//
// `scene.pause()` before each shutter, per CLAUDE.md: freezing
// `tweens.timeScale` does NOT stop `scene.update`, so short-lived FX destroy
// themselves before the frame is captured.
//
//   node tests/evidence-deflect.mjs [outDir]

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';

const OUT = process.argv[2] || 'shots';
mkdirSync(OUT, { recursive: true });
const URL = 'http://localhost:5173/?nodlg=1&nofreeze=1';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
page.on('pageerror', (e) => console.error('PAGE ERROR', e));

await page.goto(URL);
await page.waitForTimeout(4500);
await page.mouse.click(360, 640);
await page.waitForTimeout(800);
await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 4242 }));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(1500);

await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { ROOMS } = await import('/src/data/rooms.js');
  const { ENDLESS } = await import('/src/config.js');
  gs.sector = 3 * ENDLESS.bossEvery;
  gs.loadRoom(ROOMS.find((r) => r.boss));
  await new Promise((r) => setTimeout(r, 2200));
  gs.arenaActive = false;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  if (!gs.boss?.alive) { gs.spawnBoss(gs.player.x + 300, gs.player.y); await new Promise((r) => setTimeout(r, 700)); }
  gs.lives = 9999;
});

const shot = async (name) => {
  await page.evaluate(() => window.game.scene.getScene('Game').scene.pause());
  await page.waitForTimeout(120);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  await page.evaluate(() => window.game.scene.getScene('Game').scene.resume());
  await page.waitForTimeout(80);
  console.log(`  ${OUT}/${name}.png`);
};

// Slow the parry clock and hold the pair at a readable distance.
await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { ENDLESS } = await import('/src/config.js');
  window.__realParryMs = ENDLESS.bossMech.parryMs;
  ENDLESS.bossMech.parryMs = 6000;
  const b = gs.boss, p = gs.player;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  // Pinned so the camera framing is the same in every shot and a comparison
  // between two of them is a comparison of the blade, not of where they stood.
  //
  // ABSOLUTE arena positions, not an offset from wherever the player drifted
  // to. The first run of this rig only pinned them relative to each other, and
  // they happened to be near the arena's south edge — where the camera clamps —
  // so everything piled into the bottom of the frame behind the touch-control
  // overlay and the pictures showed Vader's elbow. Mid-arena keeps the camera
  // unclamped and puts him in the clear upper half.
  window.__pin = () => {
    gs.lives = 9999;
    gs.arenaActive = false;                 // no wave may start mid-shoot
    p.alive = true; p.hp = p.hpMax;
    p.setPosition(800, 900); p.setVelocity(0, 0);
    b.setVelocity(0, 0);
    b.setPosition(800, 640);                // 260px directly above the player
    b._reflectUntil = gs.time.now + 60000;
    gs.enemies.getChildren().slice().forEach((e) => { if (e.alive) gs._destroyEnemyFully(e); });
  };
  gs.events.on('postupdate', window.__pin);
  await new Promise((r) => setTimeout(r, 400));
  // ── PROVE THE SLOW CLOCK REACHED HIM ──────────────────────────────────
  // `parry()` writes `BOSS_MECH.parryMs`, so reading `_parryT` straight back is
  // the boss's OWN view of the constant. It once disagreed with the constant
  // this rig had just written: a dev server that had HMR'd a source file serves
  // the app's modules under `?t=...` URLs, so `import('/src/config.js')` from an
  // evaluate resolved to a SECOND instance and the mutation went somewhere the
  // game never read. Every parry then drew at u=0, and three shots per bearing
  // looked identical — a picture of the mechanic not animating, produced by a
  // correctly animating build.
  b.parry(0);
  const seenByBoss = b._parryT;
  b._parryT = 0; b._parryArc = null;
  if (seenByBoss !== 6000) {
    throw new Error(`slow clock did not reach the boss: he read parryMs as `
      + `${seenByBoss}, not 6000. Restart the dev server so no module is served `
      + `under an HMR ?t= URL, then re-run.`);
  }
});

// ── 1. The stance itself, with nothing in the air ─────────────────────────
await shot('01-guard-stance');

// ── 2. Four families, four frames each, through the real draw path ────────
const BEARINGS = [
  ['high',    -Math.PI / 2],
  ['low',      Math.PI / 2],
  ['lateral-right', 0],
  ['lateral-left',  Math.PI],
];
for (const [name, bearing] of BEARINGS) {
  // A REAL deflection: a real player bolt, into the real collision path, which
  // calls the real `parry()`. Nothing here sets the pose by hand.
  const fam = await page.evaluate(async (br) => {
    const gs = window.game.scene.getScene('Game');
    const b = gs.boss;
    gs.playerBullets.fire(b.x + Math.cos(br) * 90, b.y + Math.sin(br) * 90,
      br + Math.PI, 880, 200, 900, { owner: 'player' });
    for (let i = 0; i < 30 && !b._parryArc; i++) await new Promise((r) => setTimeout(r, 60));
    return b._parryArc?.id ?? 'NONE';
  }, bearing);
  console.log(`bearing ${name}: family ${fam}`);   // read after the bolt landed
  for (const u of [0, 0.25, 0.55]) {
    await page.evaluate(async (uu) => {
      const gs = window.game.scene.getScene('Game');
      const { ENDLESS } = await import('/src/config.js');
      const b = gs.boss;
      // Pinned every frame: `preUpdate` subtracts a whole frame's delta before
      // it draws, so a value written once would have moved on by the shutter.
      window.__hold = () => { b._parryT = ENDLESS.bossMech.parryMs * (1 - uu); };
      gs.events.on('postupdate', window.__hold);
      await new Promise((r) => setTimeout(r, 300));
    }, u);
    // Print the state the picture was taken in. A screenshot that looks wrong
    // is useless without knowing whether the pose was wrong or the pin was.
    const st = await page.evaluate(async () => {
      const gs = window.game.scene.getScene('Game');
      const { ENDLESS } = await import('/src/config.js');
      const b = gs.boss, ws = b.weaponSprite;
      const aim = Math.atan2(gs.player.y - b.y, gs.player.x - b.x);
      const D = 180 / Math.PI;
      return { parryT: Math.round(b._parryT), parryMs: ENDLESS.bossMech.parryMs,
               arc: b._parryArc?.id ?? null,
               angleDeg: Math.round((b._parryAngle ?? 0) * D),
               rotDeg: Math.round(ws.rotation * D),
               aimDeg: Math.round(aim * D),
               reach: Math.round(Math.hypot(ws.x - b.x, ws.y - b.y)) };
    });
    console.log(`    u=${u} ${JSON.stringify(st)}`);
    await shot(`02-parry-${name}-u${String(Math.round(u * 100)).padStart(2, '0')}`);
    await page.evaluate(() => {
      const gs = window.game.scene.getScene('Game');
      gs.events.off('postupdate', window.__hold);
      // `_parryT` only — the ARC must survive, because one bolt is fired per
      // bearing and the remaining `u` samples of that same parry still need to
      // know which family they are performing.
      gs.boss._parryT = 0;
    });
  }
}

// ── 3. The caught super, beat by beat ─────────────────────────────────────
await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { ENDLESS } = await import('/src/config.js');
  ENDLESS.bossMech.parryMs = window.__realParryMs;
  // Slow the super's own beats for the same reason as the parry's.
  window.__realGrace = ENDLESS.bossMech.superAbsorbGraceMs;
  window.__realRelease = ENDLESS.bossMech.superReleaseMs;
  ENDLESS.bossMech.superAbsorbGraceMs = 3000;
  ENDLESS.bossMech.superReleaseMs = 4000;
});

// Armed BEFORE the volley. The first version armed it after shot 05 and found
// every counter already at zero — the release had come and gone, and a listener
// registered afterwards has no way to tell "already happened" from "never will".
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  window.__released = false;
  window.__hpAtRelease = null;
  gs.events.once('boss-super-returned', () => {
    window.__released = true;
    window.__hpAtRelease = gs.player.hp;
    // THE DODGE HAPPENS HERE, on the release frame, not after two screenshots.
    // The orb crosses the pinned 260px gap in under a second and each `shot()`
    // costs ~400ms, so a sidestep taken after the in-flight photo arrived too
    // late every time: the orb had already landed for 455, the player had
    // regenerated back to full by the last frame, and the picture captioned
    // "dodged" was really a picture of a hit plus four seconds of regen. That is
    // the "photograph the wrong state and call it evidence" failure exactly.
    //
    // The pin has to come off in the same breath, because it rewrites the
    // player's position every frame and would teleport them straight back.
    gs.events.off('postupdate', window.__pin);
    // 200px, not 420. The orb's body radius is 44 and the player's is 22, so
    // 200 is already a clean miss by a wide margin — and the camera follows the
    // player, so a bigger step carries the orb's lane off the left of the frame
    // and there is no in-flight picture at all.
    gs.player.setPosition(800 + 200, 900);
  });
});

await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { PLAYER } = await import('/src/config.js');
  const b = gs.boss, p = gs.player;
  const half = (PLAYER.superPellets - 1) / 2;
  const front = Math.atan2(b.y - p.y, b.x - p.x) + Math.PI / 2;
  for (let i = 0; i < PLAYER.superPellets; i++) {
    const ox = p.x + Math.cos(front) * (i - half) * 22;
    const oy = p.y + Math.sin(front) * (i - half) * 22;
    gs.playerSuperBullets.fire(ox, oy, Math.atan2(b.y - oy, b.x - ox),
      PLAYER.superSpeed, PLAYER.superDamage * p.dmgMult, PLAYER.superRange,
      { owner: 'player', piercing: true });
  }
});

// Every beat below waits for the STATE that names it, not for a duration.
// Sleeping fixed amounts against slowed config constants was what produced a
// picture of an empty arena labelled "committed": the beats had already passed.
const waitFor = async (fn, label) => {
  try {
    await page.waitForFunction(fn, null, { timeout: 30000, polling: 60 });
  } catch (_) {
    const st = await page.evaluate(() => {
      const b = window.game.scene.getScene('Game').boss;
      return { alive: b?.alive, absorbCount: b?._absorbCount, absorbT: b?._absorbT,
               releaseN: b?._releaseN, releaseT: b?._releaseT,
               held: b?.heldSuper?.(), released: window.__released };
    });
    console.error(`NEVER REACHED: ${label} — boss state: ${JSON.stringify(st)}`);
    await browser.close();
    process.exit(1);
  }
};

await page.waitForTimeout(100);
await shot('03-super-pellets-inbound');
await waitFor(() => (window.game.scene.getScene('Game').boss?.heldSuper?.() ?? 0) > 0
                    || window.__released, 'pellets absorbed');
await shot('04-super-absorbed-gathering');
await waitFor(() => (window.game.scene.getScene('Game').boss?._releaseT ?? 0) > 0
                    || window.__released, 'he commits');
await shot('05-super-committed-pulsing');
await waitFor(() => window.__released, 'the orb leaves');
await page.screenshot({ path: `${OUT}/06-super-orb-released.png` });
console.log(`  ${OUT}/06-super-orb-released.png`);
await page.waitForTimeout(300);
await shot('07-super-orb-in-flight');
await page.waitForTimeout(900);
await shot('08-super-orb-dodged');

const summary = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { ENDLESS } = await import('/src/config.js');
  ENDLESS.bossMech.superAbsorbGraceMs = window.__realGrace;
  ENDLESS.bossMech.superReleaseMs = window.__realRelease;
  const o = gs.bossSuperOrbs.getChildren().find((x) => x.active);
  return { hpAtRelease: window.__hpAtRelease, playerHp: gs.player.hp,
           playerHpMax: gs.player.hpMax,
           tookDamage: window.__hpAtRelease != null && gs.player.hp < window.__hpAtRelease,
           orbAlive: !!o, orbDamage: o?.damage ?? null };
});
console.log('after the dodge:', JSON.stringify(summary));
await browser.close();
