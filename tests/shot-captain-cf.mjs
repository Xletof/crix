// EVIDENCE — CORE FEEL PASS: THE STEP AS A CHAIN, AND THE BODY AS A BASE.
//
//   node tests/shot-captain-cf.mjs [tag]
//
// §33/§34 are explicit that stills are not enough and that the review must not
// be run against a vertical-pixel threshold, so this rig produces BOTH:
//
//   A VIDEO at 1x of the real fight — the step deploying, and 3/4/5/6 round
//   bursts — because "does his mass transfer convincingly" is a question about
//   motion and a frozen frame cannot answer it.
//
//   STILLS of each beat, so the chain can be read one pose at a time: plant,
//   push-off, travel, CATCH, settle. The catch is the whole point of the still
//   set — it is the frame that did not exist before this pass.
//
// The x3 crops are art inspection only and are named so.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync, renameSync, readdirSync } from 'node:fs';

const TAG = process.argv[2] || 'cf';
const OUT = `docs/evidence/champion-reset/${TAG}`;
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({
  viewport: { width: 720, height: 1280 },
  recordVideo: { dir: `${OUT}/video`, size: { width: 720, height: 1280 } },
});
page.on('pageerror', (e) => console.error('PAGE ERROR', String(e).slice(0, 300)));

await page.goto('http://localhost:5173/?nodlg=1&nofreeze=1&champdbg=1');
await page.waitForTimeout(4500);
await page.mouse.click(360, 640);
await page.waitForTimeout(800);
await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 909 }));
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
  gs.player.setPosition(700, 980); gs.player.setVelocity(0, 0);
  window.__cap = gs.spawnChampion(700, 620, 'captain');
});
await page.waitForTimeout(600);

const shot = async (n) => { writeFileSync(`${OUT}/${n}.png`, await page.screenshot()); console.log('  ', n); };
const resume = () => page.evaluate(() => window.game.scene.getScene('Game').scene.resume());
const crop = async (n, w = 340) => {
  const at = await page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    const cam = gs.cameras.main;
    const c = window.__cap;
    return { x: c.x - cam.scrollX, y: c.y - cam.scrollY + cam.y };
  });
  const x = Math.max(0, Math.min(720 - w, Math.round(at.x - w / 2)));
  const y = Math.max(0, Math.min(1280 - w, Math.round(at.y - w / 2)));
  writeFileSync(`${OUT}/${n}.png`, await page.screenshot({ clip: { x, y, width: w, height: w } }));
  console.log('  ', n, '(crop)');
};

// PAUSE ON THE FRAME THE CONDITION IS TRUE, from inside the page — a
// `page.waitForFunction` poll costs 200-400ms a round trip and the plant beat
// is 90ms, so an outside observer cannot reliably stop inside it.
const pauseWhen = async (srcExpr, timeout = 25000) => {
  await page.evaluate((code) => {
    const gs = window.game.scene.getScene('Game');
    // eslint-disable-next-line no-new-func
    const test = new Function('c', 'gs', `return (${code});`);
    const h = () => {
      const c = window.__cap;
      let ok = false;
      try { ok = !!test(c, gs); } catch (e) { ok = false; }
      if (!ok) return;
      gs.events.off('postupdate', h);
      gs.cameras.main.centerOn(c.x, c.y + 40);
      gs.cameras.main.resetFX();
      gs._sectorTint?.setAlpha(0);
      window.game.scene.getScene('HUD')?.hud?.banner?.setAlpha(0);
      gs.scene.pause();
    };
    gs.events.on('postupdate', h);
  }, srcExpr);
  await page.waitForFunction(
    () => window.game.scene.getScene('Game').scene.isPaused(), null, { timeout });
  await page.waitForTimeout(220);
};

const stage = `
  const gs = window.game.scene.getScene('Game');
  const c = window.__cap;
  gs.arenaActive = false;
  gs.enemies.getChildren().slice().forEach((e) => { if (e !== c) gs._destroyEnemyFully(e); });
  gs.hostileBullets.forEach((g) => g.getChildren().forEach((b) => b.active && b.kill()));
  gs.player.hp = gs.player.hpMax;
  gs.cameras.main.stopFollow();
`;

// ── A. LIVE COMBAT, AT 1x, FOR THE VIDEO ───────────────────────────────────
// NOTHING HERE FORCES A STEP OR A BURST LENGTH. The player is driven on a
// simple lateral policy inside his band and the real solvers do the rest, so
// the footage is what a handset would produce. This is the part of the
// evidence §33 says the screenshots cannot replace.
console.log('recording live combat (the video is the evidence, the stills are the index)...');
await page.evaluate(new Function(`
  ${stage}
  c.setPosition(700, 560); c.setVelocity(0, 0);
  gs.cameras.main.startFollow(gs.player, false, 0.2, 0.2);
  let t = 0, dir = 1;
  window.__drive = () => {
    const p = gs.player;
    t += gs.game.loop.delta;
    // Lateral for a while, then push in — which is what produces the
    // aggressive-close step the handset asked for.
    if (t > 2600) { t = 0; dir *= -1; }
    const toCap = Math.atan2(c.y - p.y, c.x - p.x);
    const a = t < 1700 ? toCap + Math.PI / 2 * dir : toCap;
    p.setMoveInput({ x: Math.cos(a), y: Math.sin(a), force: 1 });
  };
  gs.events.on('postupdate', window.__drive);
`));
await page.waitForTimeout(16000);
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs.events.off('postupdate', window.__drive);
  gs.player.setMoveInput({ x: 0, y: 0, force: 0 });
  gs.cameras.main.stopFollow();
});

// ── B. THE STEP, BEAT BY BEAT ──────────────────────────────────────────────
// CROWD HIM AND LET HIM DECIDE. Nothing calls `_beginStep`: the player is
// driven inside his band and the real reason solver does the rest.
console.log('the step, as a chain:');
await page.evaluate(new Function(`
  ${stage}
  c.setPosition(700, 620); c.setVelocity(0, 0);
  c._stepCd = 0;
  window.__drive = () => {
    const p = gs.player;
    const a = Math.atan2(c.y - p.y, c.x - p.x);
    p.setMoveInput({ x: Math.cos(a), y: Math.sin(a), force: 1 });
  };
  gs.events.on('postupdate', window.__drive);
  gs.cameras.main.setScroll(700 - gs.cameras.main.width / 2, 760 - gs.cameras.main.height / 2);
`));
// THE PLANT, WITH THE SUIT ALREADY ANSWERING. The preload runs inside the
// plant, so this frame carries both: weight set, and the pack lit.
await pauseWhen("c._cap === 'step' && c._stepPlantMs > 0");
await shot('01-plant-preload');
await crop('01-plant-preload-crop');

await resume();
// NOT THE FRAME THE PLANT ENDS. `_stepThrust` builds a Graphics whose `_tick`
// closure does the drawing, and `_tick` does not run until the NEXT
// `preUpdate` — so pausing on the creation frame photographs an empty object.
await pauseWhen("c._cap === 'step' && c._stepPlantMs <= 0"
  + " && c._stateMs > c.def.step.catchMs + c.def.step.travelMs * 0.55");
await shot('02-pushoff');
await crop('02-pushoff-crop');

await resume();
await pauseWhen("c._cap === 'step' && c._stepPlantMs <= 0"
  + " && c._stateMs > c.def.step.catchMs"
  + " && c._stateMs < c.def.step.catchMs + c.def.step.travelMs * 0.45");
await shot('03-travel');
await crop('03-travel-crop');

await resume();
// ── THE CATCH — THE FRAME THAT DID NOT EXIST BEFORE THIS PASS ──────────────
//
// AND IT CANNOT BE CAUGHT BY A CONDITION POLL. The catch is 120ms and this
// harness runs at ~10fps while recording, so the whole beat is ONE FRAME —
// and resuming from a pause hands Phaser a large delta that steps straight
// over it. A `pauseWhen` on `_stepCatchMs` timed out twice.
//
// So the shutter is fired BY THE BEAT ITSELF: `_stepCatchFx` is called exactly
// once, on the frame the catch begins, by the real state machine. Two things
// have to happen before the scene stops — the effect's `_tick` closure has
// never run (a Graphics built this frame draws nothing until the NEXT
// `preUpdate`, the trap that cost B.2.1 a whole reaction sheet), and
// `_applyAnim` has not yet put him on the `land` frame. Both are invoked by
// hand, and both are the actor's own methods doing their own work.
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  const c = window.__cap;
  const real = c._stepCatchFx.bind(c);
  c._stepCatchFx = () => {
    real();
    c._reactFx.slice().forEach((o) => o._tick?.());
    c._applyAnim();
    c._stepCatchFx = real;
    gs.cameras.main.centerOn(c.x, c.y + 40);
    gs.cameras.main.resetFX();
    gs._sectorTint?.setAlpha(0);
    window.game.scene.getScene('HUD')?.hud?.banner?.setAlpha(0);
    gs.scene.pause();
  };
});
await page.waitForFunction(
  () => window.game.scene.getScene('Game').scene.isPaused(), null, { timeout: 25000 });
await page.waitForTimeout(220);
await shot('04-catch');
await crop('04-catch-crop');

await resume();
// THE THRESHOLD IS DERIVED, NOT PICKED. The whole chain is
// plant + travel + catch, so by the time it ends the cooldown has already
// fallen by that much — a literal copied from the S1 rig (where the step
// was 270ms) was UNREACHABLE here and the run died at the shutter.
await pauseWhen("c._cap !== 'step' && c._stepCd > 0"
  + " && c._stepCd > c.def.step.cooldownMs"
  + " - (c.def.step.plantMs + c.def.step.travelMs + c.def.step.catchMs) - 260");
await shot('05-settle');
await crop('05-settle-crop');

// ── C. THE FIRING BASE ─────────────────────────────────────────────────────
// The four poses of a commitment, side by side. THE FEET ARE THE CHECK: the
// stance is set on the brace and does not move again until the burst is over,
// which is what makes everything above it read as absorbed rather than bounced.
console.log('the firing base:');
await resume();
await page.evaluate(new Function(`
  ${stage}
  gs.events.off('postupdate', window.__drive);
  gs.player.setMoveInput({ x: 0, y: 0, force: 0 });
  gs.player.setPosition(700, 980);
  c.setPosition(700, 620); c.setVelocity(0, 0);
  c._stepCd = 1e9;
  gs.cameras.main.setScroll(700 - gs.cameras.main.width / 2, 760 - gs.cameras.main.height / 2);
`));
// THE PER-ROUND WINDOWS ARE 45-50ms AND THIS HARNESS RUNS AT ~10fps, so the
// recoil and correct beats fall BETWEEN frames — `_shotFlashMs` goes 140 -> 40
// in one step and the middle of the cycle is never observed. Racing it is the
// frame-rate trap; there is nothing wrong with the game.
//
// SO THE SELECTOR IS ASKED DIRECTLY, ON A PAUSED ACTOR IN A REAL BURST. The
// scene is stopped mid-commitment and `_applyAnim` — the real method, with the
// real state — is invoked at each point of its own per-round cycle. What is
// photographed is the selector's own answer for each beat, which is the thing
// under review; the frame rate is not.
await pauseWhen("c._cap === 'burst' && c._planShot > 0");
const beat = async (name, flash, shot) => {
  await page.evaluate(({ f, sh }) => {
    const c = window.__cap;
    c._shotFlashMs = f;
    c._planShot = sh;
    c._applyAnim();
    // A paused scene does not step the animation system, so the frame the key
    // names has to be put on the sprite by hand.
    const a = window.game.anims.get(c.anims.currentAnim.key);
    if (a) c.setFrame(a.frames[0].frame.name);
  }, { f: flash, sh: shot });
  await page.waitForTimeout(160);
  await crop(name, 300);
};
await beat('06-base-brace-crop', 0, 0);
await beat('07-base-fire-crop', 140, 1);
await beat('08-base-recoil-crop', 70, 1);
await beat('09-base-settle-crop', 10, 1);

// ── THE PISTON TEST, MEASURED RATHER THAN EYEBALLED ────────────────────────
// §28 asks explicitly for the helmet's, the torso's and the boots' vertical
// rhythm through a burst, and §29 forbids treating "zero vertical movement" as
// the target. So this prints the sheet's own channels per pose instead of
// asserting anything: what matters is that the per-round swing (fire ->
// recoil -> settle) is small while the ONE-TIME commitment step (brace ->
// fire) is not, which is a ratchet rather than a cycle. A human reads the
// video for whether it feels absorbed.
const chan = await page.evaluate(async () => {
  const { CAPTAIN_FRAMES } = await import('/src/systems/pixelArt.js');
  const c = window.__cap;
  const tex = c.scene.textures.get('champ-captain');
  const rows = {};
  // Measure the painted silhouette of each pose frame directly: the topmost
  // opaque row is the helmet crown and the bottom-most is the boot sole, which
  // is the only honest way to ask "did the body move" about a sprite sheet.
  const src = tex.getSourceImage();
  const cv = document.createElement('canvas');
  cv.width = src.width; cv.height = src.height;
  const ctx = cv.getContext('2d');
  ctx.drawImage(src, 0, 0);
  for (const [name, idx] of [['brace', CAPTAIN_FRAMES.brace], ['fire', CAPTAIN_FRAMES.fire],
    ['recoil', CAPTAIN_FRAMES.recoil], ['settle', CAPTAIN_FRAMES.settle]]) {
    const f = tex.get(idx);
    const d = ctx.getImageData(f.cutX, f.cutY, f.cutWidth, f.cutHeight).data;
    let top = -1, bot = -1;
    for (let y = 0; y < f.cutHeight; y++) {
      for (let x = 0; x < f.cutWidth; x++) {
        if (d[(y * f.cutWidth + x) * 4 + 3] > 40) { if (top < 0) top = y; bot = y; break; }
      }
    }
    rows[name] = { top, bot };
  }
  return rows;
});
const span = (a, b) => Math.abs(chan[a].top - chan[b].top);
console.log('  helmet crown, in texture px (x4 on screen):',
  JSON.stringify(Object.fromEntries(Object.entries(chan).map(([k, v]) => [k, v.top]))));
console.log(`  commitment step brace->fire ${span('brace', 'fire')}px`
  + `   ·   per-round swing fire->recoil ${span('fire', 'recoil')}px`
  + `, recoil->settle ${span('recoil', 'settle')}px`);
console.log('  boot sole:',
  JSON.stringify(Object.fromEntries(Object.entries(chan).map(([k, v]) => [k, v.bot]))));

await resume();
await page.waitForTimeout(400);
await page.close();
await browser.close();
// Playwright names the video by a random id; give it one a human can find.
const vids = readdirSync(`${OUT}/video`).filter((f) => f.endsWith('.webm'));
if (vids[0]) {
  renameSync(`${OUT}/video/${vids[0]}`, `${OUT}/captain-core-feel-1x.webm`);
  console.log('   captain-core-feel-1x.webm');
}
