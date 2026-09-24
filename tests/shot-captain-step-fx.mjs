// EVIDENCE — THE TACTICAL STEP AS A POWERED IMPULSE, NOT A SPLASH.
//
//   node tests/shot-captain-step-fx.mjs [tag]
//
// THE COMPLAINT WAS A SHAPE, SO THE EVIDENCE IS SHAPES. The handset called the
// old foot effect a water drop, and it was: two filled circles swelling at the
// boot in the preload, a 100px ellipse opening to 150 in the push-off, and two
// nested ellipses opening 26 -> 60 in the catch. Three soft round shapes
// spreading from a point on a flat plane is a RIPPLE, whatever colour it is.
//
// A step is four beats and no single frame can show it, so this walks them —
// ONE FRESH STEP PER STATION, because the travel is 215ms and this harness
// runs near 12fps, so a rig that pauses and resumes through one step steps
// clean over the beat it was aiming at. Every station is photographed twice:
// at 1x, which is the only scale the verdict is made at, and as a crop for
// inspection.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const TAG = process.argv[2] || 'vc';
const OUT = `docs/evidence/champion-reset/${TAG}`;
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
page.on('pageerror', (e) => console.error('PAGE ERROR', String(e).slice(0, 300)));

await page.goto('http://localhost:5173/?nodlg=1&nofreeze=1&champdbg=1');
await page.waitForTimeout(4500);
await page.mouse.click(360, 640);
await page.waitForTimeout(800);
await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 707 }));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(1500);
await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { ROOMS } = await import('/src/data/rooms.js');
  gs.loadRoom(ROOMS.find((r) => r.id === 'hangar'));
  await new Promise((r) => setTimeout(r, 2200));
  gs.lives = 9999;
  const { setGodMode } = await import('/src/systems/debug.js');
  setGodMode(true);
  gs.arenaActive = false;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  gs.player.setPosition(700, 1040); gs.player.setVelocity(0, 0);
  const c = gs.spawnChampion(700, 720, 'captain');
  c.die = () => { c.hp = Math.max(c.hp, 900); };
  window.__cap = c;
});
await page.waitForTimeout(600);

const resume = () => page.evaluate(() => window.game.scene.getScene('Game').scene.resume());

// A REAL STEP THROUGH THE REAL BEATS. `_beginStep` is the production entry
// point and it is handed the production config; the only thing the rig decides
// is WHEN and WHICH WAY, which is the one thing these frames are not about.
// The cooldown is cleared first, because a refused call reads exactly like a
// failed one.
const stepOnce = () => page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  const c = window.__cap;
  c._stepCd = 0;
  // THE GRENADE IS HELD OFF FOR THE PHOTOGRAPH. The real AI throws between
  // stations and its live field lands in the frame the step is being judged
  // in; the rig only moves the cooldown, never a gameplay number.
  c._nadeCd = 1e9;
  // HIS OWN BOLTS FROM BEFORE THE STATION ARE STILL IN FLIGHT and photograph
  // as tall white-blue shapes beside him — they read as step FX and are not.
  // Cleared, not hidden: `hostileBullets` is every hostile pool.
  gs.hostileBullets.forEach((grp) => grp.getChildren().forEach((b) => b.disableBody?.(true, true)));
  c.setPosition(700, 720); c.setVelocity(0, 0);
  c._cap = 'hold'; c._stateMs = 0;
  const d = c.def.step;
  const ok = c._beginStep(gs.player, 'close',
    { x: c.x - d.distance, y: c.y, reach: d.distance });
  return { started: c._cap === 'step', ok: ok !== false };
});

// PAUSE ON THE FRAME THE CONDITION IS TRUE, FROM INSIDE THE PAGE. An outside
// poll costs 200-400ms a round trip and the plant is 90ms.
const pauseWhen = async (expr, timeout = 20000) => {
  await page.evaluate((code) => {
    const gs = window.game.scene.getScene('Game');
    // eslint-disable-next-line no-new-func
    const test = new Function('c', 'd', 'gs', `return (${code});`);
    let armed = false;
    const h = () => {
      const c = window.__cap;
      // ── ONE FRAME OF GRACE, AND IT IS NOT A FUDGE ──────────────────────
      // `_reactFx` is ticked at the TOP of `preUpdate` and the state machine
      // runs below it, so an effect spawned on the frame a beat BEGINS is not
      // drawn until the next one — it exists, empty, for exactly one frame.
      // The first run of this rig photographed the push-off on its creation
      // frame and produced a Captain with no impulse behind him at all: the
      // harness being wrong about a build that is right. Same family as "a
      // collision-time pose lands one frame after its effect".
      if (armed) {
        gs.events.off('postupdate', h);
        const cam = gs.cameras.main;
        cam.stopFollow();
        // FRAME THE ORIGIN, NOT THE BODY. Every impulse effect is drawn where
        // he PUSHED OFF, and he is travelling away from it — a camera on the
        // moving body walks the thing being photographed out of shot, which is
        // what the first run did.
        const o = c._stepFrom || { x: c.x, y: c.y };
        window.__focus = { x: (o.x + c.x) / 2, y: (o.y + c.y) / 2 + 20 };
        cam.centerOn(window.__focus.x, window.__focus.y);
        // A PAUSED SCENE FREEZES A CAMERA FLASH FOR EVER, and `player-hurt`
        // fires one. The banner and the sector tint go the same way.
        cam.resetFX();
        gs._sectorTint?.setAlpha(0);
        window.game.scene.getScene('HUD')?.hud?.banner?.setAlpha(0);
        gs.scene.pause();
        return;
      }
      let ok = false;
      try { ok = !!(c && c.alive && test(c, c.def.step, gs)); } catch (e) { ok = false; }
      if (ok) armed = true;
    };
    gs.events.on('postupdate', h);
  }, expr);
  // A MISSED WINDOW IS A FRAME-RATE READING, NOT A BROKEN BUILD — and it must
  // not take the other stations with it.
  try {
    await page.waitForFunction(
      () => window.game.scene.getScene('Game').scene.isPaused(), null, { timeout });
  } catch (e) {
    console.log(`   !! window missed: ${expr}`);
    await page.evaluate(() => {
      const gs = window.game.scene.getScene('Game');
      gs.events.removeAllListeners('postupdate');
      gs.cameras.main.stopFollow();
      gs.cameras.main.resetFX();
      gs.scene.pause();
    });
  }
  await page.waitForTimeout(200);
};

const shot = async (n, w = 0) => {
  if (!w) {                       // 1x, the whole viewport — the verdict scale
    writeFileSync(`${OUT}/${n}.png`, await page.screenshot());
  } else {
    const at = await page.evaluate(() => {
      const gs = window.game.scene.getScene('Game');
      const cam = gs.cameras.main;
      const f = window.__focus || window.__cap;
      return { x: f.x - cam.scrollX, y: f.y - cam.scrollY + cam.y };
    });
    const x = Math.max(0, Math.min(720 - w, Math.round(at.x - w / 2)));
    const y = Math.max(0, Math.min(1280 - w, Math.round(at.y - w / 2)));
    writeFileSync(`${OUT}/${n}.png`, await page.screenshot({ clip: { x, y, width: w, height: w } }));
  }
  console.log('  ', n);
};

console.log('the tactical step, beat by beat:');
const station = async (name, expr) => {
  await resume();
  const r = await stepOnce();
  if (!r.started) console.log(`   !! step refused for ${name}`, JSON.stringify(r));
  await pauseWhen(expr);
  await shot(`${name}-1x`);
  await shot(`${name}-crop`, 420);
};

// `_stateMs` counts DOWN from plant + travel + catch, so the beats are read
// off it rather than off a wall clock the harness does not have. ONE FRESH
// STEP PER STATION: the travel is 215ms against a ~12fps harness.
//
// BEFORE: one frame of the Captain standing, so the sequence has a baseline.
await resume();
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  const c = window.__cap;
  c.setPosition(700, 720); c.setVelocity(0, 0); c._cap = 'hold'; c._stateMs = 400;
  window.__focus = { x: c.x - 100, y: c.y + 20 };
  const cam = gs.cameras.main; cam.stopFollow(); cam.centerOn(window.__focus.x, window.__focus.y);
  cam.resetFX(); gs.scene.pause();
});
await page.waitForTimeout(250);
await shot('30-before-1x'); await shot('30-before-crop', 420);

await station('31-plant', "c._cap === 'step' && c._stepPlantMs > 0");
await station('33-pushoff',
  "c._cap === 'step' && c._stepPlantMs <= 0 && c._stateMs > d.catchMs + d.travelMs * 0.5");
await station('34-early-travel', "c._stepRingFx?._beat === 'travel' && c._stepRingFx._k < 0.5");
await station('35-late-travel', "c._stepRingFx?._beat === 'travel' && c._stepRingFx._k >= 0.5");
// THE FIRST CATCH FRAME and THE HERO FRAME, addressed by the field overlay's
// own published beat: the catch is 120ms and the harness sees ~1.5 frames of it.
await station('36-FIRST-CATCH', "c._stepRingFx?._beat === 'collapse' || c._stepRingFx?._beat === 'hero'");
await station('36b-HERO-FRAME', "c._stepRingFx?._beat === 'hero'");
await station('37-settle', "c._stepRingFx?._beat === 'cool' && c._stepRingFx._k > 0.45");

// ── THE PLAYER DASH, SAME ROOM, SAME CAMERA RULE — the comparison ────────
// Not to make them alike: to hold both against the same bar at 1x.
const dashStation = async (name, expr) => {
  await resume();
  await page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    const c = window.__cap;
    c.setPosition(700, 520); c.setVelocity(0, 0);
    c._stepCd = 1e9; c._nadeCd = 1e9;
    gs.hostileBullets.forEach((grp) => grp.getChildren().forEach((b) => b.disableBody?.(true, true)));
    const p = gs.player;
    p.setPosition(760, 900); p.setVelocity(0, 0); p.alive = true;
    p.dashCharges = 3; p.isDashing = false;
    p.facing = Math.PI; p._moveTargetX = -1; p._moveTargetY = 0;
    window.__dashFrom = { x: p.x, y: p.y };
    p.tryDash();
  });
  await page.evaluate((code) => {
    const gs = window.game.scene.getScene('Game');
    // eslint-disable-next-line no-new-func
    const test = new Function('p', `return (${code});`);
    let armed = false;
    const h = () => {
      const p = gs.player;
      if (armed) {
        gs.events.off('postupdate', h);
        const cam = gs.cameras.main;
        cam.stopFollow();
        const o = window.__dashFrom;
        window.__focus = { x: (o.x + p.x) / 2, y: (o.y + p.y) / 2 };
        cam.centerOn(window.__focus.x, window.__focus.y);
        cam.resetFX(); gs._sectorTint?.setAlpha(0);
        window.game.scene.getScene('HUD')?.hud?.banner?.setAlpha(0);
        gs.scene.pause();
        return;
      }
      if (test(p)) armed = true;
    };
    gs.events.on('postupdate', h);
  }, expr);
  try {
    await page.waitForFunction(() => window.game.scene.getScene('Game').scene.isPaused(), null, { timeout: 15000 });
  } catch (e) { console.log(`   !! dash window missed: ${expr}`); return; }
  await page.waitForTimeout(200);
  await shot(`${name}-1x`);
  await shot(`${name}-crop`, 420);
};
await dashStation('40-DASH-early', 'p.isDashing && Math.hypot(p.x - window.__dashFrom.x, p.y - window.__dashFrom.y) > 20');
await dashStation('41-DASH-late', 'p.isDashing && Math.hypot(p.x - window.__dashFrom.x, p.y - window.__dashFrom.y) > 90');

await browser.close();
