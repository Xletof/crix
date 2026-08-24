// EVIDENCE — VADER'S SABER AS A LIGHT SOURCE, during LIGHTS OUT only.
//
// The dark arena was approved structurally and rejected artistically: the room
// loses power, but nothing in it starts BEHAVING like a light, so Vader reads
// as a black body holding a bright red line. This rig photographs the saber
// across its whole combat vocabulary in darkness and measures three things an
// eye cannot settle on its own:
//
//   - the glow exists ONLY in darkness (normal lighting must be untouched);
//   - it is a light SOURCE — the region around the blade brightens and reddens,
//     and Vader's own silhouette recovers some of itself from it;
//   - it never becomes the blade — the physics body is byte-identical.
//
// The "before" is not a memory: `LIGHTSOUT.saber` is zeroed live, on the same
// frozen frame, so the A/B is one change in one room rather than two builds
// photographed on two different afternoons.
//
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
import zlib from 'node:zlib';

const URL = 'http://localhost:5173/?nodlg=1&nofreeze=1';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const OUT = 'docs/evidence/saber-glow';

// Chromium screenshots are colour type 2 (RGB, 3 bytes/px), not RGBA.
function decodePNG(buf) {
  let p = 8, w = 0, h = 0, ct = 6; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p); const type = buf.toString('ascii', p + 4, p + 8);
    if (type === 'IHDR') { w = buf.readUInt32BE(p + 8); h = buf.readUInt32BE(p + 12); ct = buf[p + 17]; }
    if (type === 'IDAT') idat.push(buf.subarray(p + 8, p + 8 + len));
    p += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = ct === 2 ? 3 : 4, stride = w * bpp; const out = Buffer.alloc(h * stride); let o = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[o++]; const line = raw.subarray(o, o + stride); o += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y ? out.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      cur[x] = v & 255;
    }
  }
  return { w, h, bpp, px: out };
}
const clampBox = (im, x0, y0, x1, y1) => [
  Math.max(0, Math.min(im.w, x0 | 0)), Math.max(84, Math.min(im.h, y0 | 0)),
  Math.max(0, Math.min(im.w, x1 | 0)), Math.max(84, Math.min(im.h, y1 | 0))];
// Mean luminance AND mean red excess. A light source does not merely raise
// brightness in its neighbourhood, it raises brightness OF ITS OWN COLOUR —
// and red excess is the half a global exposure change cannot fake.
function stats(im, bx) {
  const [x0, y0, x1, y1] = clampBox(im, ...bx);
  let l = 0, rx = 0, n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * im.w + x) * im.bpp;
    const r = im.px[i], g = im.px[i + 1], b = im.px[i + 2];
    l += 0.2126 * r + 0.7152 * g + 0.0722 * b;
    rx += r - (g + b) / 2;
    n++;
  }
  return n ? { lum: +(l / n).toFixed(2), red: +(rx / n).toFixed(2) } : { lum: 0, red: 0 };
}

const browser = await chromium.launch({ executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
page.on('pageerror', (e) => console.error('PAGE ERROR', e));

await page.goto(URL);
await page.waitForTimeout(4500);
await page.mouse.click(360, 640);
await page.waitForTimeout(800);
await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 777 }));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(1500);

await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { ROOMS } = await import('/src/data/rooms.js');
  const { ENDLESS } = await import('/src/config.js');
  gs.sector = 6 * ENDLESS.bossEvery;
  gs.loadRoom(ROOMS.find((r) => r.boss));
  await new Promise((r) => setTimeout(r, 2200));
  gs.arenaActive = false;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  if (!gs.boss?.alive) { gs.spawnBoss(900, 900); await new Promise((r) => setTimeout(r, 700)); }
  gs.player.hp = gs.player.hpMax; gs.lives = 9999;
  // SILENCE HIS FREE-RUNNING CLOCKS AT SETUP, not later. This rig FORCES the
  // arena state; a real BLACKOUT or ECLIPSE landing alongside it arms the
  // owner's own 2.6s turn-off, and 2.6s later that fades the forced darkness
  // out from under a shot — which reads exactly like a glow that was never
  // implemented. Cost a full run.
  const b = gs.boss, FAR = 1e9;
  b._blackoutT = FAR; b._afterimageT = FAR; b._disarmT = FAR; b._sunderT = FAR;
  b._reflectT = FAR; b.cooldown = FAR; b._moveT = FAR;
});
await page.waitForTimeout(600);

const R = { shots: [] };
const hush = () => page.evaluate(() => {
  const gs = window.game.scene.getScene('Game'), b = gs.boss, FAR = 1e9;
  if (!b) return;
  b._blackoutT = FAR; b._afterimageT = FAR; b._disarmT = FAR; b._sunderT = FAR;
  b._reflectT = FAR; b.cooldown = FAR; b._moveT = FAR; b._attackT = FAR;
  b.hp = b.hpMax; gs.player.hp = gs.player.hpMax;
  // NOTHING IN FRAME BUT THE TWO MEN AND THE SABER. A live SUNDER telegraph is
  // a red circle with radial spokes sitting exactly where the glow is, and it
  // photographs as the effect under test.
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  b._performing = null;
  // And drop any turn-off the owner has already armed: this rig owns the
  // arena state, so a timer from a real activation must not outlive the shot.
  gs._lightsEndEv?.remove?.(); gs._lightsEndEv = null;
  gs.clearTelegraphs?.();
});
// Vader parked at a known offset from a stationary player, aim frozen at a
// known bearing: every shot below is the same two bodies in the same places,
// so a difference between two frames is the saber and nothing else.
const stage = (aim = -Math.PI / 4) => page.evaluate((a) => {
  const gs = window.game.scene.getScene('Game');
  gs.player.setPosition(800, 980); gs.player.setVelocity(0, 0);
  gs.boss.setPosition(800, 800); gs.boss.setVelocity(0, 0);
  gs.boss._aim = a;
  gs.cameras.main.centerOn(800, 880);
}, aim);
const forceDark = (on) => page.evaluate((o) => {
  const gs = window.game.scene.getScene('Game');
  const hud = window.game.scene.getScene('HUD');
  gs._clearLightsOut();
  if (!o) return;
  gs._enterDarkArena();
  gs._darkChain?.stop?.(); gs._darkMix.v = 1; gs._applyDarkMix();
  hud.setDarkness(true, 'blackout');
  hud._darkTweens.blackout?.stop?.(); hud._overlays.blackout.setAlpha(1);
}, on);   // A DROPPED ARGUMENT READS EXACTLY LIKE AN UNIMPLEMENTED FEATURE.
// Without `on`, `o` is undefined, the guard above returns, and every shot in
// this file photographed a lit room while every probe reported the glow
// missing. Two runs went into a bug that was never in the game.
// A full-screen hurt flash at 0.9 alpha photographs as a flat red rectangle
// with the whole arena behind it — and if the scene is PAUSED mid-flash it
// never fades. Heal, let it run out, then shoot.
const settle = async (ms = 700) => { await hush(); await page.waitForTimeout(ms); await hush(); };
// ECLIPSE's clones ARE enemies, and `hush` sweeps enemies — hushing before
// counting them measured zero clones on a composition that had spawned three.
const hushKeepClones = () => page.evaluate(() => {
  const gs = window.game.scene.getScene('Game'), b = gs.boss, FAR = 1e9;
  if (!b) return;
  b._blackoutT = FAR; b._afterimageT = FAR; b._disarmT = FAR; b._sunderT = FAR;
  b._reflectT = FAR; b.cooldown = FAR; b._moveT = FAR; b._attackT = FAR;
  b.hp = b.hpMax; gs.player.hp = gs.player.hpMax;
});
const shot = async (name) => { writeFileSync(`${OUT}/${name}.png`, await page.screenshot()); R.shots.push(name); return name; };
// Where the blade IS, in screen space, straight from the sprite the one writer
// owns. Every measurement box below is anchored to this rather than to a guess.
const bladeBox = (padX = 60, padY = 60) => page.evaluate(([px, py]) => {
  const gs = window.game.scene.getScene('Game');
  const w = gs.boss.weaponSprite, cam = gs.cameras.main;
  const sx = (w.x - cam.worldView.x), sy = (w.y - cam.worldView.y) + cam.y;
  const half = w.displayWidth * 0.5;
  return { sx, sy, box: [sx - half - px, sy - half - py, sx + half + px, sy + half + py],
           rot: +w.rotation.toFixed(4), x: +w.x.toFixed(1), y: +w.y.toFixed(1) };
}, [padX, padY]);

// ══ 1. THE MATCHED A/B — one frozen frame, one change ═══════════════════
await stage();
await hush();
await page.waitForTimeout(400);
await settle();
await forceDark(true);
await page.waitForTimeout(250);
// Clear and freeze in ONE round trip. A separate `pause` call leaves 50-200ms
// of live game between the sweep and the shutter, which is enough for a fresh
// telegraph to open on top of the thing being measured.
await settle(500);
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs.clearTelegraphs?.(); gs.scene.pause();
});

const bb = await bladeBox();
// "Before": the approved build's saber, reproduced exactly by zeroing the three
// alphas this pass added. Nothing else in the frame moves.
// "Before" is the approved build, and the honest way to reproduce it is to
// take away the two objects this pass added — not to zero a config the page
// may have imported as a different module instance. The readback exists
// because a toggle that silently does nothing produces a PERFECT A/B: two
// identical screenshots and zero deltas, which is also what a broken feature
// looks like. It already happened once here.
const showGlow = (on) => page.evaluate((o) => {
  const b = window.game.scene.getScene('Game').boss;
  b._saberHalo?.setVisible(o); b._saberBloom?.setVisible(o);
  return { halo: !!b._saberHalo?.visible, bloom: !!b._saberBloom?.visible };
}, on);
// The scene is paused, so nothing draws them for us — prime them by hand once.
await page.evaluate(() => window.game.scene.getScene('Game').boss._drawSaberGlow());
R.abToggle = {};

R.abToggle.off = await showGlow(false); await page.waitForTimeout(120);
const before = decodePNG(await page.screenshot());
writeFileSync(`${OUT}/ab-1-dark-no-glow.png`, await page.screenshot());
R.abToggle.on = await showGlow(true); await page.waitForTimeout(120);
const after = decodePNG(await page.screenshot());
writeFileSync(`${OUT}/ab-2-dark-with-glow.png`, await page.screenshot());

// Three concentric claims: at the blade, in the darkness immediately around
// it, and on Vader's own body — which is BEHIND the emitter, so any change
// there is spill and cannot be the blade itself.
const bodyBox = [bb.sx - 150, bb.sy - 40, bb.sx - 40, bb.sy + 110];
const REG = {
  'blade':            bb.box.map((v, i) => (i < 2 ? v + 55 : v - 55)),
  'near darkness':    bb.box,
  'wide darkness':    [bb.box[0] - 90, bb.box[1] - 90, bb.box[2] + 90, bb.box[3] + 90],
  "Vader's body":     bodyBox,
  'far corner':       [10, 1000, 200, 1200],
  'viewport':         [0, 84, 720, 1280],
};
R.ab = {};
for (const [k, r] of Object.entries(REG)) {
  const a = stats(before, r), b = stats(after, r);
  R.ab[k] = { before: a, after: b,
    dLum: +(b.lum - a.lum).toFixed(2), dRed: +(b.red - a.red).toFixed(2) };
}
await page.evaluate(() => window.game.scene.getScene('Game').scene.resume());
await page.waitForTimeout(200);

// ══ 2. NORMAL LIGHT MUST BE UNTOUCHED ═══════════════════════════════════
await forceDark(false);
await page.waitForTimeout(700);
await stage(); await settle();
await page.evaluate(() => window.game.scene.getScene('Game').scene.pause());
const litOn = decodePNG(await page.screenshot());
writeFileSync(`${OUT}/ab-3-normal-light.png`, await page.screenshot());
R.normalLight = {
  glow: await page.evaluate(() => {
    const b = window.game.scene.getScene('Game').boss;
    return { mix: window.game.scene.getScene('Game')._darkMix?.v ?? 0,
             haloVisible: !!b._saberHalo?.visible, bloomVisible: !!b._saberBloom?.visible };
  }),
  blade: stats(litOn, REG.blade), viewport: stats(litOn, REG.viewport),
};
await page.evaluate(() => window.game.scene.getScene('Game').scene.resume());

// ══ 3. THE HITBOX IS FROZEN ═════════════════════════════════════════════
R.bodyFrozen = await page.evaluate(async () => {
  const b = window.game.scene.getScene('Game').boss, bd = b.body;
  const { BOSS } = await import('/src/config.js');
  return { radius: bd.radius, cfgRadius: BOSS.radius,
           // The weapon sprite is an overlay and has never had a body; the two
           // glow layers are Graphics. Nothing this pass added can be collided
           // with, and the blade's own reach is the sprite's, untouched.
           weaponHasBody: !!b.weaponSprite.body,
           haloHasBody: !!b._saberHalo?.body, bloomHasBody: !!b._saberBloom?.body,
           texW: b.weaponSprite.width, texH: b.weaponSprite.height };
});

// ══ 4. THE COMBAT VOCABULARY, IN THE DARK ═══════════════════════════════
// REGISTRY IDS, NOT BANNER TEXT. `bossMoveById('SABER THROW')` is undefined and
// `_castBossMove` returns null on it — which is indistinguishable from the
// ownership gate refusing, and from the move running and doing nothing. Every
// gate is cleared here too, for the same reason.
const bossAct = (id) => page.evaluate((f) => {
  const gs = window.game.scene.getScene('Game'), b = gs.boss;
  b._activeMove = null; b._performing = null; b.state = 'idle'; b.cooldown = 0;
  b._reflectUntil = 0; b._reflectClaimed = false;
  return !!gs._castBossMove?.(b, f);
}, id);
const relit = async () => { await settle(400); await forceDark(true); await page.waitForTimeout(200); await hush(); };

R.poses = [];
// The pose is read back from the sprite AND from the glow on the same frame,
// so "it follows the blade" is a measurement rather than a screenshot.
const poseCheck = async (label) => {
  // SAMPLED FROM INSIDE ONE FRAME. Reading the sprite and the glow from two
  // separate `page.evaluate` round trips compares a blade to a light drawn
  // 200-400ms apart, and on a boss that is walking they will never agree —
  // which reads as a glow that does not follow. This listener is added AFTER
  // the boss's own, so it runs after the draw, on the same postupdate.
  const p = await page.evaluate((l) => new Promise((res) => {
    const gs = window.game.scene.getScene('Game'), b = gs.boss;
    const grab = () => {
      gs.events.off('postupdate', grab);
      const w = b.weaponSprite, h = b._saberHalo, g = b._saberBloom;
      res({ label: l, away: !!b._saberAway,
      mix: gs._darkMix?.v ?? null, lights: gs._lightsState, snap: !!gs._darkSnap,
      endEv: !!gs._lightsEndEv, cdEv: !!gs._lightsCdEv, pend: gs._lightsPending || null,
      w: { x: +w.x.toFixed(2), y: +w.y.toFixed(2), rot: +w.rotation.toFixed(4), vis: w.visible },
      halo:  h ? { x: +h.x.toFixed(2), y: +h.y.toFixed(2), rot: +h.rotation.toFixed(4), vis: h.visible } : null,
      bloom: g ? { x: +g.x.toFixed(2), y: +g.y.toFixed(2), rot: +g.rotation.toFixed(4), vis: g.visible } : null });
    };
    gs.events.on('postupdate', grab);
  }), label);
  // `p.w.rot`, NOT `p.w.rotation` — the sampled object renames it, and
  // comparing against the missing key made every pose report a mismatch on a
  // set of numbers that were in fact identical.
  p.matches = !!p.halo && p.halo.x === p.w.x && p.halo.y === p.w.y && p.halo.rot === p.w.rot
           && !!p.bloom && p.bloom.x === p.w.x && p.bloom.y === p.w.y && p.bloom.rot === p.w.rot;
  R.poses.push(p);
  return p;
};

await relit();
await stage(); await page.waitForTimeout(250); await hush();
await shot('seq-01-aim-stationary');       await poseCheck('aim');

// Directional parry — the follow-through gesture, at speed.
await page.evaluate(() => window.game.scene.getScene('Game').boss.parry(Math.PI / 2));
await page.waitForTimeout(60);
await shot('seq-02-parry');                await poseCheck('parry');

// DEFLECTION stance — the blade held off his aim line.
await relit();
await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { ENDLESS } = await import('/src/config.js');
  gs.boss._reflectUntil = gs.time.now + ENDLESS.bossMech.reflectMs;
});
await page.waitForTimeout(200); await hush();
await shot('seq-03-deflection-stance');    await poseCheck('deflection');

// Super power-sweep — the throw, mid-arc.
await relit();
await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { ENDLESS } = await import('/src/config.js');
  const b = gs.boss;
  b._absorbCount = 5;
  b._releaseT = ENDLESS.bossMech.superSweepMs * 0.75;
  b._sweepDir = Math.cos(b._aim) >= 0 ? -1 : 1;
});
await page.waitForTimeout(90);
await shot('seq-04-super-power-sweep');    await poseCheck('super-sweep');
await page.evaluate(() => { const b = window.game.scene.getScene('Game').boss;
  b._absorbCount = 0; b._releaseT = 0; b._sweepDir = 0; b._followT = 0; });

// SABER COMBO — the blade across his own body.
await relit();
R.castCombo = await bossAct('sabercombo');
await page.waitForTimeout(500);
await shot('seq-05-saber-combo');          await poseCheck('combo');

// SABER THROW — the blade 500px away, and the light with it.
// A REFUSED CAST READS EXACTLY LIKE A FAILED ONE, and a 260ms round trip can
// step straight over a flight. Cast and sample INSIDE the page, on postupdate,
// until the blade is genuinely off him — then hold the frame and photograph it.
await relit();
// Staged HIGH in the arena on purpose: the game camera clamps at the world
// bounds, so a throw resolved near the floor puts both men in the bottom strip
// whatever the camera is told to centre on.
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs.player.setPosition(800, 700); gs.player.setVelocity(0, 0);
  gs.boss.setPosition(800, 560); gs.boss.setVelocity(0, 0);
  gs.cameras.main.stopFollow(); gs.cameras.main.centerOn(800, 640);
});
await page.waitForTimeout(200);
R.throwTruth = await page.evaluate(() => new Promise((res) => {
  const gs = window.game.scene.getScene('Game'), b = gs.boss;
  let tries = 0, best = null;
  const tick = () => {
    // Not merely "away" — the first frame of the flight is still at his rest
    // offset, and a photograph of that is a photograph of a blade in his hand.
    const flying = b._saberAway
      && Math.hypot(b.weaponSprite.x - b.x, b.weaponSprite.y - b.y) > 220;
    if (flying && !best) {
      const w = b.weaponSprite, h = b._saberHalo;
      best = { saberAway: true, hasSaber: b.hasSaber(), tries,
        distFromHand: +Math.hypot(w.x - b.x, w.y - b.y).toFixed(1),
        // Anchored to the SPRITE, so this is the same number by construction —
        // there is no second glowing blade left at his hand to measure.
        haloDistFromHand: h ? +Math.hypot(h.x - b.x, h.y - b.y).toFixed(1) : null,
        haloOnBlade: h ? (h.x === w.x && h.y === w.y && h.rotation === w.rotation) : false,
        glowObjects: [b._saberHalo, b._saberBloom].filter(Boolean).length };
      gs.scene.pause();               // hold the flight for the photograph
      gs.events.off('postupdate', tick);
      return res(best);
    }
    if (++tries % 12 === 0) {
      b._activeMove = null; b._performing = null; b.state = 'idle'; b.cooldown = 0;
      b._reflectUntil = 0; b._reflectClaimed = false;
      gs._castBossMove?.(b, 'saberthrow');
    }
    if (tries > 400) { gs.events.off('postupdate', tick);
      return res({ saberAway: false, tries, note: 'the cast was refused for the whole window' }); }
  };
  gs.events.on('postupdate', tick);
}));
// The camera follows the PLAYER, and a thrown blade 240px off a boss who is
// himself off-centre puts both of them outside the frame — a photograph of an
// empty room proves nothing about phantom sabers. Frame the pair.
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game'), b = gs.boss, w = b.weaponSprite;
  gs.cameras.main.stopFollow();
  gs.cameras.main.centerOn((b.x + w.x) / 2, (b.y + w.y) / 2);
});
await shot('seq-06-saber-throw-away');
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs.scene.resume(); gs.cameras.main.startFollow(gs.player, false, 0.12, 0.12);
});
await poseCheck('throw-after-catch');
await page.waitForTimeout(1400);

// VANISH — and this is the harder case than CHARGE, deliberately. CHARGE and
// OVERHEAD SLAM are his own state machine and their blade is written by the
// same one writer as `aim`, so the pose invariant above already covers them.
// VANISH is the move that TWEENS `weaponSprite.rotation` (`spin()` in
// actorMotion) — a second author for a number `preUpdate` owns, and the one
// place a glow read before the tween manager steps would visibly separate.
await relit();
R.castVanish = await bossAct('vanishslash');
await page.waitForTimeout(320);
await shot('seq-07-vanish-spin');          await poseCheck('vanish-spin');

// The silhouette shot: blade across the body, room dark, nothing else running.
// THE SILHOUETTE SHOT. `stage(aim)` cannot choose the bearing — the weapon
// block re-derives it from the player's position every frame — so the pose is
// chosen by where the PLAYER stands. Put them due north of him: he aims north,
// the blade draws BEHIND his body by the facing-north depth rule, and the
// spill lands across the front of a man who is otherwise nearly black.
await relit();
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs.player.setPosition(800, 620); gs.player.setVelocity(0, 0);
  gs.boss.setPosition(800, 800); gs.boss.setVelocity(0, 0);
  gs.cameras.main.stopFollow(); gs.cameras.main.centerOn(800, 720);
});
await page.waitForTimeout(400); await hush();
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs.clearTelegraphs?.(); gs.cameras.main.centerOn(800, 720);
});
await shot('seq-08-silhouette-blade-across-body'); await poseCheck('silhouette');
R.silhouette = await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game'), b = gs.boss;
  const w = b.weaponSprite;
  return { bladeDepth: w.depth, bossDepth: b.depth, haloDepth: b._saberHalo?.depth ?? null,
           // Blade behind him, spill in front of him: the light lands ON the
           // silhouette rather than being hidden by it.
           bladeBehindBoss: w.depth < b.depth, haloOverBoss: (b._saberHalo?.depth ?? -1) > b.depth,
           aimDeg: +(b._aim * 180 / Math.PI).toFixed(1) };
});
await page.evaluate(() => { const gs = window.game.scene.getScene('Game');
  gs.cameras.main.startFollow(gs.player, false, 0.12, 0.12); });

// ECLIPSE — three clones that carry NO saber, and the one man who does.
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs._clearLightsOut(); gs.boss._eclipse = true; gs.requestLightsOut('eclipse');
});
await page.waitForTimeout(750); await hushKeepClones();
await shot('seq-09-eclipse');
R.eclipse = await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  const clones = gs.enemies.getChildren().filter((e) => e.alive && e._afterimage);
  return { clones: clones.length,
           clonesWithVisibleWeapon: clones.filter((c) => c.weaponSprite?.visible).length,
           clonesWithGlow: clones.filter((c) => c._saberHalo || c._saberBloom).length,
           // The islands of remaining power, drawn once per state change.
           consoleGlow: (() => { const g = gs._consoleGlow;
             return g ? { visible: g.visible, depth: g.depth,
               consoles: gs.roomLayer.getChildren().filter((o) => o._loClass === 'console').length } : null; })() };
});

// ══ 5. RESTORATION ══════════════════════════════════════════════════════
await page.evaluate(() => window.game.scene.getScene('Game')._endLightsOut());
await page.waitForTimeout(220); await hush();
await shot('seq-10-lights-returning');
await page.waitForTimeout(800); await hush();
await shot('seq-11-normal-arena-again');
R.afterRestore = await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game'), b = gs.boss;
  return { mix: gs._darkMix?.v ?? null,
           haloVisible: !!b._saberHalo?.visible, bloomVisible: !!b._saberBloom?.visible,
           consoleGlowVisible: !!gs._consoleGlow?.visible,
           lightsState: gs._lightsState };
});

console.log(JSON.stringify(R, null, 2));
writeFileSync(`${OUT}/saber-glow.json`, JSON.stringify(R, null, 2));
await browser.close();
