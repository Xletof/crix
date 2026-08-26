// THE ARENA PILOT'S STRUCTURAL TRUTHS.
//
// This test protects the things the environment pass could break WITHOUT
// anybody noticing on a phone. It does NOT assert that the room looks better —
// that is a handset verdict and no assertion here has an opinion about it.
//
// What it protects, and why each one is here rather than assumed:
//
//   1. GAMEPLAY GEOMETRY IS UNCHANGED. Bounds, cover positions and bodies, prop
//      bodies, gates, spawns. The whole pass is painted art, so the only way it
//      can regress the game is by accidentally becoming collision.
//   2. NO ENVIRONMENT ART BECAME A PHYSICS BODY. `walls` must contain exactly
//      the room's own cover and solid props and nothing else. A baked
//      architecture primitive or an emissive image that reached that group
//      would silently block bullets, nav and LOS.
//   3. THE EMISSIVE LAYER IS OUTSIDE `roomLayer`. That group is the LIGHTS OUT
//      tint's subject; a light inside it gets multiplied toward black, which is
//      the exact failure the layer exists to avoid. This is the same
//      by-construction argument `smoke-vader` makes for combat objects.
//   4. THE POWER STATE IS DETERMINISTIC AND RESTORES EXACTLY. A full outage and
//      recovery must return every emissive to its authored normal-power alpha,
//      and `_clearLightsOut` must too — a run that ends mid-blackout must not
//      hand the next room a lit-up or a dead emissive layer.
//   5. NOTHING LEAKS ACROSS ROOM LOADS. Load the arena three times and assert
//      the emissive object count is constant and the shared glow textures are
//      created once, not once per room.
//   6. THE PLACEHOLDER IS GONE, NOT DUPLICATED. `_drawConsoleGlow` and its
//      three config keys must not exist alongside their replacement.
//   7. LIGHTS OUT'S OWNER AND CLOCKS ARE UNTOUCHED. This pass was allowed to
//      change environment presentation and nothing else about the mechanic.
//   8. THE SABER EMISSIVE IS UNTOUCHED. Frozen on 83dee24 and not this pass's
//      business, but it lives in the same config block the pilot edited.
//
// Added with the polish pass (HANDOVER 10o):
//
//   9. A `face` IS CONTAINED BY ITS PROP. The hero machine's two ADD faces are
//      the one part of the emissive layer allowed above depth 3, and the whole
//      argument for that is that a face's rectangle is its prop's rectangle.
//      Measured against the live sprite's bounds, not assumed.
//  10. THE OTHER THREE ARENAS OPT OUT. Each non-boss room is loaded for real
//      and must build an EMPTY emissive layer and carry none of the pilot's
//      opt-in spec fields. A shared painter that defaults to on is how one
//      arena's language quietly becomes four.
//  11. THE MACHINE HAS TWO STATES, not one dimmer — one face dead at normal
//      power with a real emergency figure, one lit at normal power.
//  12. NO RED IN THE ENVIRONMENT, channel-tested on the spec's own colours.
//      The check self-tests against three known reds and three known non-reds
//      in the same run, because AMBER IS NOT RED and the first version of it
//      failed the room's emergency strips.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

// `?nodlg=1` — the dialogue card PAUSES Game and HUD, and every probe below
// runs against a live scene.
await page.goto('http://localhost:5173/?nodlg=1');
await page.waitForTimeout(4000);
await page.mouse.click(360, 640);
await page.waitForTimeout(600);
await page.evaluate(() => {
  const t = window.game?.scene?.getScene('Title');
  if (t?.sys?.isActive()) t.scene.start('Game', { mode: 'endless', seed: 4242 });
});
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(1200);

const R = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const gs = window.game.scene.getScene('Game');
  const { ROOMS } = await import('/src/data/rooms.js');
  const { LIGHTSOUT, ENDLESS } = await import('/src/config.js');
  const { ENV_LIGHT_DEPTH } = await import('/src/systems/EnvLight.js');
  const spec = ROOMS.find((r) => r.boss);

  const out = { spec: {}, cfg: {}, geom: {}, layer: {}, power: {}, leak: {} };

  // ── The room spec's own gameplay geometry. Compared against the frozen
  //    values below in Node, so an edit to rooms.js has to argue with a check.
  out.spec = {
    bounds: spec.bounds,
    spawn: spec.spawn,
    bossSpawn: spec.bossSpawn,
    exit: spec.exit,
    gates: spec.gates,
    cover: spec.cover,
    props: (spec.props || []).map((p) => ({ x: p.x, y: p.y, solid: !!p.solid, bodyW: p.bodyW, bodyH: p.bodyH })),
    wallsLen: spec.walls.length,
    hasEmissives: Array.isArray(spec.emissives) && spec.emissives.length > 0,
    hasArchitecture: Array.isArray(spec.floor?.architecture) && spec.floor.architecture.length > 0,
    // Every colour the authored light spends, split into channels for the
    // red-discipline check in Node.
    emissiveColors: (spec.emissives || []).flatMap((e) => [e.color, e.hot].filter((v) => v != null).map((v) => ({
      kind: e.kind, hex: '#' + v.toString(16).padStart(6, '0'),
      r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255,
    }))),
    propFaces: (spec.props || []).flatMap((p) => (p.faces || []).map((f) => ({ tex: f.tex, normal: f.normal, emergency: f.emergency }))),
  };

  // ── The mechanic's clocks and owner. Presentation was in scope; none of this
  //    was.
  out.cfg = {
    onsetMs: LIGHTSOUT.onsetMs,
    restoreMs: LIGHTSOUT.restoreMs,
    sectorTintAlpha: LIGHTSOUT.sectorTintAlpha,
    lightsReentryMs: ENDLESS.bossMech.lightsReentryMs,
    hasRequestLightsOut: typeof gs.requestLightsOut === 'function',
    // The placeholder and its config keys must be GONE, not retained beside
    // their replacement.
    hasDrawConsoleGlow: typeof gs._drawConsoleGlow === 'function',
    hasConsoleGlowObj: '_consoleGlow' in gs,
    consoleGlowKeys: ['consoleGlowAlpha', 'consoleGlowColor', 'consoleGlowRadius']
      .filter((k) => k in LIGHTSOUT),
    // Frozen on 83dee24. Read out rather than remembered.
    saber: { ...LIGHTSOUT.saber },
    envLightDepth: ENV_LIGHT_DEPTH,
  };

  // ── Load the pilot arena for real.
  gs.sector = 6 * ENDLESS.bossEvery;
  gs.loadRoom(spec);
  await sleep(1400);
  gs.arenaActive = false;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  await sleep(200);

  // ── PHYSICS TRUTH. `walls` is the group nav, LOS and bullet collision all
  //    read, so it is the one place environment art could do real damage.
  const wallKids = gs.walls.getChildren().filter((w) => w.active);
  out.geom = {
    worldBounds: {
      w: gs.physics.world.bounds.width, h: gs.physics.world.bounds.height,
      x: gs.physics.world.bounds.x, y: gs.physics.world.bounds.y,
    },
    cameraBounds: { w: gs.cameras.main._bounds.width, h: gs.cameras.main._bounds.height },
    wallBodies: wallKids.length,
    // Every body in the group, so a stray one shows up as a coordinate that is
    // not in the spec rather than only as a count.
    bodies: wallKids.map((w) => ({
      x: Math.round(w.x), y: Math.round(w.y),
      bw: Math.round(w.body.width), bh: Math.round(w.body.height),
      tex: w.texture?.key,
    })).sort((a, b) => a.x - b.x || a.y - b.y),
    navBlocked: gs.navGrid?.blockedCount?.() ?? null,
    losRects: gs.losRects.length,
  };

  // ── LAYER SEPARATION. The exemption list is the renderer's own grouping, and
  //    that is only true while it stays true.
  const roomKids = gs.roomLayer.getChildren();
  const envParts = gs.envLight?.parts || [];
  out.layer = {
    envLightExists: !!gs.envLight,
    envPartCount: envParts.length,
    // 1. no emissive object is inside the tinted group
    anyEnvInRoomLayer: envParts.some((p) => roomKids.includes(p)),
    // 2. no emissive object has a physics body
    anyEnvHasBody: envParts.some((p) => !!p.body),
    // 3. every emissive object sits below the actor band — EXCEPT a `face`,
    //    which is bolted to an opaque prop and takes that prop's depth + 1.
    //    See `faces` below for the containment proof that keeps that honest.
    envDepths: [...new Set(envParts.filter((p) => !p._face).map((p) => p.depth))],
    faceCount: envParts.filter((p) => p._face).length,
    // A face may only cover pixels its prop already covers opaquely. That is
    // the entire argument for letting it out of depth 3, so it is measured
    // rather than assumed: the face's rectangle against the prop's rectangle,
    // and its depth against the prop's.
    faces: envParts.filter((p) => p._face).map((p) => {
      const fb = p.getBounds();
      // The prop this face claims to be bolted to: the roomLayer object whose
      // depth is exactly one below it.
      const host = roomKids.find((o) => o._loClass === 'prop' && Math.abs(o.depth - (p.depth - 1)) < 1e-6);
      const hb = host?.getBounds?.();
      return {
        tex: p.texture?.key,
        depth: p.depth,
        hostTex: host?.texture?.key ?? null,
        hostDepth: host?.depth ?? null,
        additive: p.blendMode === Phaser.BlendModes.ADD,
        contained: !!hb && fb.x >= hb.x - 0.5 && fb.y >= hb.y - 0.5
          && fb.right <= hb.right + 0.5 && fb.bottom <= hb.bottom + 0.5,
        // And it must still be under the things it could otherwise hide: no
        // face may reach the flat depths combat FX and the HUD live at.
        belowCombatCeiling: p.depth < 2000,
      };
    }),
    // 4. every emissive object is ADD-blended — a NORMAL-blend one would be a
    //    grey rectangle on the deck rather than light
    allEnvAdditive: envParts.every((p) => p.blendMode === Phaser.BlendModes.ADD),
    // 5. the four material classes are still tagged at creation
    loClasses: [...new Set(roomKids.map((o) => o._loClass))].sort(),
    roomLayerCount: roomKids.length,
  };

  // ── POWER STATE. Sample one emissive's alpha through a full cycle.
  const sample = () => envParts.map((p) => +(p.alpha ?? 0).toFixed(4));
  const normalAlphas = sample();

  gs._enterDarkArena();
  gs._darkChain?.stop?.();
  gs._darkMix.v = 1; gs._applyDarkMix();
  const darkAlphas = sample();

  gs._darkMix.v = 0; gs._applyDarkMix(); gs._restoreArenaTints();
  const restoredAlphas = sample();

  // And the hard path: a room torn down mid-outage.
  gs._enterDarkArena();
  gs._darkChain?.stop?.();
  gs._darkMix.v = 1; gs._applyDarkMix();
  gs._clearLightsOut();
  const clearedAlphas = sample();

  out.power = {
    normalAlphas, darkAlphas, restoredAlphas, clearedAlphas,
    // At least one source must actually be dark at normal power and lit under
    // emergency — that is what makes the second state an authored composition
    // rather than a dimmer. A pass where every alpha is equal in both states is
    // a pass that proves nothing.
    anyOffAtNormal: normalAlphas.some((a, i) => a <= 0.002 && darkAlphas[i] > 0.02),
    anyBrighterInDark: darkAlphas.some((a, i) => a > normalAlphas[i] + 0.02),
    restoresExactly: restoredAlphas.every((a, i) => Math.abs(a - normalAlphas[i]) < 1e-6),
    clearRestoresExactly: clearedAlphas.every((a, i) => Math.abs(a - normalAlphas[i]) < 1e-6),
    // Nothing left drawing at full emergency strength once the lights are back.
    noStaleGlow: restoredAlphas.every((a, i) => a <= normalAlphas[i] + 1e-6),
  };

  // ── LIFECYCLE. Reload the arena twice more and watch for accumulation.
  const partsBefore = envParts.length;
  const texBefore = window.game.textures.getTextureKeys().filter((k) => k.startsWith('env-glow-')).length;
  const displayBefore = gs.children.list.length;
  for (let i = 0; i < 2; i++) { gs.loadRoom(spec); await sleep(900); }
  gs.arenaActive = false;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  await sleep(200);
  out.leak = {
    partsBefore,
    partsAfter: gs.envLight?.parts?.length ?? -1,
    // The two falloff textures plus the emitter face, created ONCE for the
    // process. Three rooms must not be three copies.
    glowTexBefore: texBefore,
    glowTexAfter: window.game.textures.getTextureKeys().filter((k) => k.startsWith('env-glow-')).length,
    displayBefore,
    displayAfter: gs.children.list.length,
    // A destroyed EnvLight must leave nothing behind that is still rendering.
    // Counts the faces too — they are ADD objects the layer owns at a prop's
    // depth, so a leaked one would otherwise slip past a depth-3 sweep.
    orphanAdditiveAtEnvDepth: gs.children.list.filter(
      (o) => o.blendMode === Phaser.BlendModes.ADD && (o.depth === ENV_LIGHT_DEPTH || o._face),
    ).length,
  };

  // ── THE OTHER THREE ARENAS ARE NOT IN THE PILOT. Every piece of this pass is
  //    opt-in per room — `floor.grounded`, a non-empty `emissives`, and now a
  //    prop's `faces`. Load each of them for real and assert the emissive layer
  //    they get is EMPTY, because a shared painter that quietly defaults to on
  //    is exactly how one arena's visual language becomes four.
  out.others = [];
  for (const r of ROOMS.filter((x) => !x.boss)) {
    gs.loadRoom(r);
    await sleep(700);
    gs.arenaActive = false;
    gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
    out.others.push({
      id: r.id,
      specEmissives: (r.emissives || []).length,
      specGrounded: !!r.floor?.grounded,
      specArchitecture: (r.floor?.architecture || []).length,
      specPropFaces: (r.props || []).reduce((n, pr) => n + (pr.faces || []).length, 0),
      specPerimeter: r.perimeter?.style ?? null,
      envParts: gs.envLight?.parts?.length ?? -1,
      additiveAtEnvDepth: gs.children.list.filter(
        (o) => o.blendMode === Phaser.BlendModes.ADD && (o.depth === ENV_LIGHT_DEPTH || o._face),
      ).length,
    });
  }
  return out;
});

console.log(JSON.stringify(R, null, 2));
console.log('page errors:', errors.length ? errors : 'none');

// ── THE FROZEN GAMEPLAY GEOMETRY. Read out of the pre-pilot build (1b837d0)
//    and written here as literals on purpose: a check that derives its
//    expectation from the same file it is checking cannot fail.
const FROZEN = {
  bounds: { w: 1600, h: 1600 },
  spawn: { x: 800, y: 1350 },
  bossSpawn: { x: 800, y: 400 },
  exit: { x: 1500, y: 1200, side: 'right' },
  gates: [{ x: 800, y: 100 }, { x: 800, y: 1500 }, { x: 100, y: 800 }, { x: 1500, y: 800 }],
  // POST-`snapAll`. The spec writes 400/1200; `mapUtils.snapAll` moves them onto
  // the nav lattice at load, and 440 is what the game has always actually used.
  // Freezing the pre-snap numbers would have failed on the untouched build.
  cover: [{ x: 440, y: 440 }, { x: 1240, y: 440 }, { x: 440, y: 1240 }, { x: 1240, y: 1240 }],
  props: [{ x: 340, y: 740, solid: true, bodyW: 220, bodyH: 120 }],
  wallsLen: 0,
};
// Frozen with DEFLECTION on 6b98bbc and closed out on 83dee24.
const SABER = {
  innerMul: 1.50, innerColor: 0xffb09c, innerAlpha: 0.40,
  tightMul: 2.80, tightColor: 0xff2a18, tightAlpha: 0.36,
  haloMul: 9.2, haloSteps: 6, haloColor: 0x9c140a, haloAlpha: 0.225,
  backMul: 2.9, tipMul: 1.6, maxMix: 1,
};

const fails = [];
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// 1 — gameplay geometry
for (const k of Object.keys(FROZEN)) {
  if (!eq(R.spec[k], FROZEN[k])) fails.push(`GEOMETRY MOVED: spec.${k} = ${JSON.stringify(R.spec[k])}, frozen ${JSON.stringify(FROZEN[k])}`);
}
if (R.geom.worldBounds.w !== 1600 || R.geom.worldBounds.h !== 1600) fails.push(`arena bounds are ${R.geom.worldBounds.w}x${R.geom.worldBounds.h}`);
if (R.geom.cameraBounds.w !== 1600 || R.geom.cameraBounds.h !== 1600) fails.push('camera bounds no longer match the arena');

// 2 — nothing painted became collision. 4 cover + 1 solid prop + 0 walls.
if (R.geom.wallBodies !== 5) fails.push(`walls group holds ${R.geom.wallBodies} bodies, expected 5 (4 cover + 1 solid prop)`);
if (R.geom.losRects !== 5) fails.push(`losRects is ${R.geom.losRects}, expected 5`);
const covBodies = R.geom.bodies.filter((b) => b.tex === 'bush');
if (covBodies.length !== 4 || covBodies.some((b) => b.bw !== 70 || b.bh !== 70)) {
  fails.push(`cover bodies wrong: ${JSON.stringify(covBodies)}`);
}
const podBody = R.geom.bodies.find((b) => b.tex === 'prop-pod');
if (!podBody || podBody.bw !== 220 || podBody.bh !== 120) fails.push(`pod body wrong: ${JSON.stringify(podBody)}`);

// 3 — layer separation
if (!R.layer.envLightExists) fails.push('the arena has no emissive layer');
if (R.layer.envPartCount < 20) fails.push(`emissive layer has only ${R.layer.envPartCount} parts`);
if (R.layer.anyEnvInRoomLayer) fails.push('an emissive object is inside roomLayer — LIGHTS OUT will tint the room light toward black');
if (R.layer.anyEnvHasBody) fails.push('an emissive object has a physics body');
if (!R.layer.allEnvAdditive) fails.push('an emissive object is not ADD-blended');
if (!eq(R.layer.envDepths, [R.cfg.envLightDepth])) fails.push(`non-face emissive objects are at depths ${JSON.stringify(R.layer.envDepths)}, expected only ${R.cfg.envLightDepth}`);
// The hero machine's two ADD faces. They are the one part of the emissive layer
// allowed above depth 3, and only because a face's rectangle is its prop's
// rectangle — anything it could hide, the prop hid first.
if (R.layer.faceCount !== 2) fails.push(`the hero prop carries ${R.layer.faceCount} emissive faces, expected 2`);
for (const f of R.layer.faces) {
  if (f.hostTex !== 'prop-pod') fails.push(`face ${f.tex} is at depth ${f.depth} with no prop directly under it (found ${f.hostTex})`);
  if (!f.contained) fails.push(`face ${f.tex} draws outside its prop's rectangle — it can cover pixels the prop does not`);
  if (!f.additive) fails.push(`face ${f.tex} is not ADD-blended`);
  if (!f.belowCombatCeiling) fails.push(`face ${f.tex} is at depth ${f.depth}, above the combat band`);
}
if (R.cfg.envLightDepth >= 90) fails.push(`environment light is at depth ${R.cfg.envLightDepth} — it must stay below the actor band`);
// No 'wall' — the chamber's `walls: []` is deliberate and predates this pass.
if (!eq(R.layer.loClasses, ['console', 'floor', 'prop'])) {
  fails.push(`roomLayer material classes are ${JSON.stringify(R.layer.loClasses)}`);
}

// 4 — the power state
if (!R.power.anyOffAtNormal) fails.push('no source is dark at normal power and lit under emergency — the second state is a dimmer, not a composition');
if (!R.power.anyBrighterInDark) fails.push('no source gets brighter when the room loses power');
if (!R.power.restoresExactly) fails.push('emissive alphas did not return to their normal-power values after an outage');
if (!R.power.clearRestoresExactly) fails.push('_clearLightsOut left the emissive layer at the wrong intensity');
if (!R.power.noStaleGlow) fails.push('stale glow: a source is brighter after restore than it was before the outage');

// 5 — lifecycle
if (R.leak.partsAfter !== R.leak.partsBefore) fails.push(`emissive part count drifted across room loads: ${R.leak.partsBefore} -> ${R.leak.partsAfter}`);
if (R.leak.glowTexAfter !== R.leak.glowTexBefore || R.leak.glowTexAfter !== 3) {
  fails.push(`glow textures: ${R.leak.glowTexBefore} -> ${R.leak.glowTexAfter}, expected a constant 3`);
}
if (R.leak.orphanAdditiveAtEnvDepth !== R.leak.partsAfter) {
  fails.push(`${R.leak.orphanAdditiveAtEnvDepth} additive objects at the env-light depth but the layer owns ${R.leak.partsAfter} — a previous room's lights survived`);
}

// 5b — ONE ARENA. The other three rooms must still opt out of every part of it.
for (const o of R.others) {
  if (o.specEmissives || o.specGrounded || o.specArchitecture || o.specPropFaces) {
    fails.push(`PROPAGATED: ${o.id} has picked up pilot spec fields ${JSON.stringify(o)}`);
  }
  if (o.specPerimeter === 'chamber') fails.push(`PROPAGATED: ${o.id} is using the pilot's perimeter style`);
  if (o.envParts !== 0) fails.push(`${o.id} built ${o.envParts} emissive parts — the layer is meant to be empty there`);
  if (o.additiveAtEnvDepth !== 0) fails.push(`${o.id} has ${o.additiveAtEnvDepth} additive environment objects left drawing`);
}

// 5c — NO RED IN THE ENVIRONMENT. Red is the saber, the SABER THROW lane and
// the telegraphs, and the room spends none of it. Checked on the spec's own
// numbers rather than on a screenshot: for every authored source, the red
// channel may not be the dominant one. The hero machine's single fault lamp is
// painted into a texture and is one logical pixel; it is deliberately not an
// EnvLight source, so it cannot pass through here as a colour.
// AMBER IS NOT RED, and a naive `r > g` test says it is — the first version of
// this check failed the emergency strips, which are the room's warmest and most
// deliberate colour. What separates them is how far the green channel falls:
// amber holds green at roughly two thirds of red, danger red drops it under a
// third. The threshold is 0.42 and the self-test below proves it discriminates.
const isDangerRed = (c) => c.r > 60 && c.g < c.r * 0.42 && c.b < c.r * 0.42;
for (const known of [{ r: 255, g: 42, b: 24 }, { r: 176, g: 48, b: 48 }, { r: 138, g: 26, b: 26 }]) {
  if (!isDangerRed(known)) fails.push('the red-discipline check does not recognise red — it is decoration');
}
for (const known of [{ r: 255, g: 171, b: 82 }, { r: 106, g: 52, b: 6 }, { r: 143, g: 216, b: 255 }]) {
  if (isDangerRed(known)) fails.push('the red-discipline check flags amber or cyan — it would fail every honest palette');
}
for (const src of R.spec.emissiveColors) {
  if (isDangerRed(src)) fails.push(`RED IN THE ENVIRONMENT: a ${src.kind} source is ${src.hex}`);
}

// 6 — the placeholder is replaced, not duplicated
if (R.cfg.hasDrawConsoleGlow) fails.push('_drawConsoleGlow still exists alongside its replacement');
if (R.cfg.hasConsoleGlowObj) fails.push('the _consoleGlow Graphics still exists');
if (R.cfg.consoleGlowKeys.length) fails.push(`LIGHTSOUT still carries the placeholder keys: ${R.cfg.consoleGlowKeys.join(', ')}`);

// 7 — the mechanic's clocks and owner
if (R.cfg.onsetMs !== 140) fails.push(`LIGHTSOUT.onsetMs is ${R.cfg.onsetMs}, was 140`);
if (R.cfg.restoreMs !== 420) fails.push(`LIGHTSOUT.restoreMs is ${R.cfg.restoreMs}, was 420`);
if (R.cfg.lightsReentryMs !== 14000) fails.push(`lightsReentryMs is ${R.cfg.lightsReentryMs}, was 14000`);
if (!R.cfg.hasRequestLightsOut) fails.push('GameScene.requestLightsOut is gone — darkness lost its single owner');

// 8 — the saber emissive is not this pass's business
for (const k of Object.keys(SABER)) {
  if (R.cfg.saber[k] !== SABER[k]) fails.push(`FROZEN SABER GLOW MOVED: ${k} = ${R.cfg.saber[k]}, was ${SABER[k]}`);
}

// 5d — THE HERO MACHINE'S SECOND STATE. Two faces, and one of them must be
// DEAD at normal power and live under emergency. That pair is the whole reason
// the machine becomes a landmark when the room goes out instead of just going
// dark with everything else.
if (R.spec.propFaces.length !== 2) fails.push(`the hero prop declares ${R.spec.propFaces.length} faces, expected 2`);
if (!R.spec.propFaces.some((f) => f.normal === 0 && f.emergency > 0.2)) {
  fails.push('no face on the hero machine is reserved for emergency power — its second state is a dimmer');
}
if (!R.spec.propFaces.some((f) => f.normal > 0.1)) {
  fails.push('the hero machine shows no light at normal power');
}

// The pilot has to actually exist, or every check above passes vacuously.
if (!R.spec.hasEmissives) fails.push('the pilot room has no authored emissives');
if (!R.spec.hasArchitecture) fails.push('the pilot room has no authored architecture');

if (errors.length) fails.push(`page errors: ${errors.join(' | ')}`);
console.log(fails.length ? `\nFAIL:\n - ${fails.join('\n - ')}` : '\nPASS: the arena pilot is art — geometry, collision, the darkness owner and the saber are untouched');
await browser.close();
process.exit(fails.length ? 1 : 0);
