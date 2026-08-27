// THE SECOND ARENA'S STRUCTURAL TRUTHS.
//
// `smoke-arena` protects the Vader chamber. This protects the hangar, and it
// exists for a different reason: the chamber was a PILOT and could be judged on
// its own, while the hangar is a GENERALIZATION TEST — so what has to hold here
// is not only "the room is still art" but "the shared machinery grew a second
// user without either room reaching into the other".
//
// What it protects, and why each one is here rather than assumed:
//
//   1. GAMEPLAY GEOMETRY IS UNCHANGED. Bounds, the eight cover positions and
//      their 70x70 bodies, the five solid prop bodies, spawn, exit, gates,
//      terminals, pickups and the enemy list. The whole pass is painted art, so
//      the only way it can regress the game is by becoming collision.
//   2. NO ENVIRONMENT ART BECAME A PHYSICS BODY. `walls` must hold exactly the
//      8 cover objects and the 5 solid props — 13 and no more. The two wall
//      control panels are decoration and must NOT be in it: they are the first
//      objects this project has put in playable space on purpose, and "no
//      body, no nav cell, no LOS rect" is the entire licence for that.
//   3. THE EMISSIVE LAYER IS OUTSIDE `roomLayer`, ADD-blended, below the actor
//      band, and owns no physics body. Same by-construction argument the pilot
//      makes; asserted again because the hangar builds it from a different mix
//      (authored sources, prop `kit` lights, derived console lights).
//   4. THE POWER STATE RESTORES EXACTLY, through an outage and through a room
//      torn down mid-outage.
//   5. NOTHING LEAKS ACROSS ROOM LOADS, and the shared glow textures are still
//      created once for the process rather than once per room.
//   6. THE COVER KIT IS HONEST. Every archetype standing in this room renders
//      at `bush`'s footprint over a 70x70 body — that is the collision
//      contract, not a style rule. Cargo crates declare no light and take the
//      unpowered material tint; consoles declare light and take the console
//      tint.
//   7. NO RED IN THE ENVIRONMENT, channel-tested on every authored and derived
//      colour, with the same amber-is-not-red self-test the pilot uses.
//   8. THE ROOM HAS TWO AUTHORED STATES, not one dimmer, and its nominal lamps
//      do not get louder in the dark.
//   9. THE HANGAR IS NOT THE CHAMBER. It must not use the chamber's perimeter
//      style, must not carry the hero machine or its emissive faces, and must
//      not be standing on the chamber's floor architecture. A second room that
//      passed by copying the first would prove nothing.
//  10. SPAWNING VADER DOES NOT CHANGE THE ROOM. The debug contract, asserted
//      from the hangar because that is the workflow this pass depends on.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

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
  const { ENDLESS, LIGHTSOUT } = await import('/src/config.js');
  const { ENV_LIGHT_DEPTH } = await import('/src/systems/EnvLight.js');
  const { CONSOLE_KIT, consoleEmissives } = await import('/src/data/consoleKit.js');
  const spec = ROOMS.find((r) => r.id === 'hangar');
  const chamber = ROOMS.find((r) => r.boss);
  const out = {};

  const cols = (e) => [e.color, e.hot].filter((v) => v != null).map((v) => ({
    hex: '#' + v.toString(16).padStart(6, '0'),
    r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255,
  }));

  out.spec = {
    bounds: spec.bounds,
    spawn: spec.spawn,
    exit: spec.exit,
    gates: spec.gates,
    terminals: spec.terminals,
    pickups: spec.pickups,
    enemies: spec.enemies.map((e) => ({ type: e.type, x: e.x, y: e.y })),
    cover: spec.cover.map((c) => ({ x: c.x, y: c.y })),
    coverTex: spec.cover.map((c) => c.tex ?? 'bush'),
    solidProps: (spec.props || []).filter((p) => p.solid)
      .map((p) => ({ x: p.x, y: p.y, tex: p.tex, bodyW: p.bodyW, bodyH: p.bodyH })),
    looseProps: (spec.props || []).filter((p) => !p.solid)
      .map((p) => ({ x: p.x, y: p.y, tex: p.tex, kit: p.kit ?? null, depth: p.depth ?? null })),
    wallsLen: spec.walls.length,
    perimeterStyle: spec.perimeter?.style ?? null,
    perimeterFeatures: (spec.perimeter?.features || []).map((f) => ({ kind: f.kind, side: f.side, at: f.at })),
    propFaces: (spec.props || []).reduce((n, p) => n + (p.faces || []).length, 0),
    architectureKinds: [...new Set((spec.floor?.architecture || []).map((a) => a.kind))].sort(),
    architectureLen: (spec.floor?.architecture || []).length,
    stripEvery: spec.floor?.stripEvery,
    emissiveCount: (spec.emissives || []).length,
    emissiveColors: (spec.emissives || []).flatMap((e) => cols(e).map((c) => ({ kind: e.kind, ...c }))),
    // Two independent intensities, read straight off the spec.
    anySpecOffAtNormal: (spec.emissives || []).some((e) => (e.normal ?? 0) === 0 && (e.emergency ?? 0) > 0.1),
    ledsLouderInDark: (spec.emissives || []).filter((e) => e.kind === 'led')
      .some((e) => (e.emergency ?? 0) > (e.normal ?? 0) + 1e-6),
  };

  // ── THE CHAMBER, READ FROM THE SAME PLACE. This pass may not have moved it.
  out.chamber = {
    coverTex: chamber.cover.map((c) => c.tex ?? 'bush'),
    cover: chamber.cover.map((c) => ({ x: c.x, y: c.y })),
    perimeterStyle: chamber.perimeter?.style ?? null,
    props: (chamber.props || []).map((p) => ({ x: p.x, y: p.y, tex: p.tex, bodyW: p.bodyW, bodyH: p.bodyH })),
    propFaces: (chamber.props || []).reduce((n, p) => n + (p.faces || []).length, 0),
    emissiveCount: (chamber.emissives || []).length,
    architectureLen: (chamber.floor?.architecture || []).length,
    thickness: chamber.perimeter?.thickness,
  };

  out.cfg = {
    onsetMs: LIGHTSOUT.onsetMs, restoreMs: LIGHTSOUT.restoreMs,
    lightsReentryMs: ENDLESS.bossMech.lightsReentryMs,
    envLightDepth: ENV_LIGHT_DEPTH,
  };

  // ── Load the hangar for real, at a late sector.
  gs.sector = 6 * ENDLESS.bossEvery;
  gs.loadRoom(spec);
  await sleep(1400);
  gs.arenaActive = false;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  await sleep(200);

  const wallKids = gs.walls.getChildren().filter((w) => w.active);
  out.geom = {
    worldBounds: { w: gs.physics.world.bounds.width, h: gs.physics.world.bounds.height },
    cameraBounds: { w: gs.cameras.main._bounds.width, h: gs.cameras.main._bounds.height },
    wallBodies: wallKids.length,
    losRects: gs.losRects.length,
    bodies: wallKids.map((w) => ({
      x: Math.round(w.x), y: Math.round(w.y), tex: w.texture?.key,
      bw: Math.round(w.body.width), bh: Math.round(w.body.height),
      dw: Math.round(w.displayWidth), dh: Math.round(w.displayHeight),
      loClass: w._loClass,
    })).sort((a, b) => a.x - b.x || a.y - b.y),
  };

  const roomKids = gs.roomLayer.getChildren();
  const envParts = gs.envLight?.parts || [];
  out.layer = {
    envPartCount: envParts.length,
    anyEnvInRoomLayer: envParts.some((p) => roomKids.includes(p)),
    anyEnvHasBody: envParts.some((p) => !!p.body),
    allEnvAdditive: envParts.every((p) => p.blendMode === Phaser.BlendModes.ADD),
    envDepths: [...new Set(envParts.map((p) => p.depth))],
    faceCount: envParts.filter((p) => p._face).length,
    loClasses: [...new Set(roomKids.map((o) => o._loClass))].sort(),
    // The two wall panels: in the room layer, drawing, and carrying NO body.
    wallPanels: roomKids.filter((o) => o.texture?.key === 'ch-con-wall')
      .map((o) => ({ x: Math.round(o.x), y: Math.round(o.y), depth: o.depth, hasBody: !!o.body, loClass: o._loClass })),
  };

  // ── THE COVER KIT AS PLACED, and every light it derives.
  out.kit = {
    derived: (spec.cover || []).flatMap((cp) => consoleEmissives(cp.tex ?? 'bush', cp.x, cp.y))
      .map((e) => ({ kind: e.kind, x: Math.round(e.x), y: Math.round(e.y), normal: e.normal, emergency: e.emergency, colors: cols(e) })),
    propKit: (spec.props || []).filter((p) => p.kit)
      .flatMap((p) => consoleEmissives(p.kit, p.x, p.y - 56))
      .map((e) => ({ kind: e.kind, x: Math.round(e.x), y: Math.round(e.y), colors: cols(e) })),
    inKit: (spec.cover || []).map((c) => !!CONSOLE_KIT[c.tex ?? 'bush']),
    texSizes: [...Object.keys(CONSOLE_KIT), 'ch-crate-a', 'ch-crate-b', 'bush']
      .filter((k) => window.game.textures.exists(k))
      .map((k) => { const t = window.game.textures.get(k).getSourceImage(); return { k, w: t.width, h: t.height }; }),
  };

  // ── POWER.
  const sample = () => envParts.map((p) => +(p.alpha ?? 0).toFixed(4));
  const normalAlphas = sample();
  gs._enterDarkArena(); gs._darkChain?.stop?.();
  gs._darkMix.v = 1; gs._applyDarkMix();
  const darkAlphas = sample();
  gs._darkMix.v = 0; gs._applyDarkMix(); gs._restoreArenaTints();
  const restoredAlphas = sample();
  gs._enterDarkArena(); gs._darkChain?.stop?.();
  gs._darkMix.v = 1; gs._applyDarkMix();
  gs._clearLightsOut();
  const clearedAlphas = sample();
  out.power = {
    anyOffAtNormal: normalAlphas.some((a, i) => a <= 0.002 && darkAlphas[i] > 0.02),
    anyBrighterInDark: darkAlphas.some((a, i) => a > normalAlphas[i] + 0.02),
    restoresExactly: restoredAlphas.every((a, i) => Math.abs(a - normalAlphas[i]) < 1e-6),
    clearRestoresExactly: clearedAlphas.every((a, i) => Math.abs(a - normalAlphas[i]) < 1e-6),
    noStaleGlow: restoredAlphas.every((a, i) => a <= normalAlphas[i] + 1e-6),
  };

  // ── LIFECYCLE. Three loads of the same room, then the chamber and back, so
  //    the two styled arenas have to hand the layer over cleanly to each other.
  const partsBefore = envParts.length;
  const texBefore = window.game.textures.getTextureKeys().filter((k) => k.startsWith('env-glow-')).length;
  const displayBefore = gs.children.list.length;
  for (let i = 0; i < 2; i++) { gs.loadRoom(spec); await sleep(800); }
  gs.loadRoom(chamber); await sleep(900);
  const chamberParts = gs.envLight?.parts?.length ?? -1;
  gs.loadRoom(spec); await sleep(900);
  gs.arenaActive = false;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  await sleep(200);
  out.leak = {
    partsBefore, partsAfter: gs.envLight?.parts?.length ?? -1, chamberParts,
    glowTexBefore: texBefore,
    glowTexAfter: window.game.textures.getTextureKeys().filter((k) => k.startsWith('env-glow-')).length,
    displayBefore, displayAfter: gs.children.list.length,
    orphanAdditive: gs.children.list.filter(
      (o) => o.blendMode === Phaser.BlendModes.ADD && (o.depth === ENV_LIGHT_DEPTH || o._face),
    ).length,
    wallBodiesAfter: gs.walls.getChildren().filter((w) => w.active).length,
  };

  // ── SPAWN VADER KEEPS THE ROOM. The debug contract this whole pass leans on.
  const roomBefore = gs.roomSpec?.id;
  gs.spawnBoss(800, 500);
  await sleep(800);
  out.debug = {
    roomBefore, roomAfter: gs.roomSpec?.id,
    bossAlive: !!gs.boss?.alive,
    boundsAfter: { w: gs.physics.world.bounds.width, h: gs.physics.world.bounds.height },
  };
  return out;
});

console.log(JSON.stringify(R, null, 2));
console.log('page errors:', errors.length ? errors : 'none');

// ── FROZEN HANGAR GEOMETRY. Read out of the pre-pass build (a639ea6) and
//    written here as literals: a check that derives its expectation from the
//    file it is checking cannot fail. Cover is POST-`snapAll`.
const FROZEN = {
  bounds: { w: 1600, h: 1400 },
  spawn: { x: 200, y: 700 },
  exit: { x: 1500, y: 700, side: 'right' },
  gates: [{ x: 1500, y: 200 }, { x: 1500, y: 1200 }, { x: 800, y: 100 }],
  terminals: [{ x: 800, y: 700 }],
  pickups: [{ x: 600, y: 360, weapon: 'rifle' }],
  enemies: [
    { type: 'grunt', x: 760, y: 200 }, { type: 'grunt', x: 760, y: 1240 },
    { type: 'grunt', x: 1300, y: 400 }, { type: 'grunt', x: 1300, y: 1000 },
    { type: 'shooter', x: 1050, y: 700 },
  ],
  cover: [
    { x: 520, y: 360 }, { x: 840, y: 360 }, { x: 1080, y: 360 },
    { x: 520, y: 1080 }, { x: 840, y: 1080 }, { x: 1080, y: 1080 },
    { x: 680, y: 520 }, { x: 920, y: 920 },
  ],
  solidProps: [
    { x: 420, y: 470, tex: 'prop-shuttle', bodyW: 150, bodyH: 190 },
    { x: 420, y: 1140, tex: 'prop-crane', bodyW: 300, bodyH: 70 },
    { x: 1310, y: 250, tex: 'prop-drum', bodyW: 60, bodyH: 50 },
    { x: 1380, y: 300, tex: 'prop-drum-b', bodyW: 60, bodyH: 50 },
    { x: 1250, y: 1130, tex: 'prop-drum-b', bodyW: 60, bodyH: 50 },
  ],
  wallsLen: 0,
};
// The chamber, frozen by handset verdict on a639ea6.
const CHAMBER = {
  coverTex: ['ch-con-ped-a', 'ch-con-ped-b', 'ch-con-heavy', 'ch-con-ped-a'],
  cover: [{ x: 440, y: 440 }, { x: 1240, y: 440 }, { x: 440, y: 1240 }, { x: 1240, y: 1240 }],
  perimeterStyle: 'chamber',
  props: [{ x: 340, y: 740, tex: 'prop-pod', bodyW: 220, bodyH: 120 }],
  propFaces: 2,
  emissiveCount: 23,
  architectureLen: 32,
  thickness: 80,
};

const fails = [];
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// 1 — gameplay geometry
for (const k of Object.keys(FROZEN)) {
  if (!eq(R.spec[k], FROZEN[k])) fails.push(`HANGAR GEOMETRY MOVED: spec.${k} = ${JSON.stringify(R.spec[k])}`);
}
if (R.geom.worldBounds.w !== 1600 || R.geom.worldBounds.h !== 1400) fails.push(`arena bounds are ${R.geom.worldBounds.w}x${R.geom.worldBounds.h}`);
if (R.geom.cameraBounds.w !== 1600 || R.geom.cameraBounds.h !== 1400) fails.push('camera bounds no longer match the arena');

// 2 — nothing painted became collision. 8 cover + 5 solid props.
if (R.geom.wallBodies !== 13) fails.push(`walls group holds ${R.geom.wallBodies} bodies, expected 13 (8 cover + 5 solid props)`);
if (R.geom.losRects !== 13) fails.push(`losRects is ${R.geom.losRects}, expected 13`);
const cov = R.geom.bodies.filter((b) => b.bw === 70 && b.bh === 70);
if (cov.length !== 8) fails.push(`expected 8 cover bodies at 70x70, found ${cov.length}`);
for (const b of R.geom.bodies) {
  if (b.tex === 'ch-con-wall') fails.push(`a wall control panel became a physics body at ${b.x},${b.y}`);
}
// THE WALL PANELS ARE DECORATION. Present, drawing, below the actor band, and
// carrying no body — the whole licence for putting art in playable space.
if (R.layer.wallPanels.length !== 2) fails.push(`expected 2 wall control panels in the room layer, found ${R.layer.wallPanels.length}`);
for (const wp of R.layer.wallPanels) {
  if (wp.hasBody) fails.push(`the wall panel at ${wp.x},${wp.y} has a physics body`);
  if (wp.depth >= 90) fails.push(`the wall panel at ${wp.x},${wp.y} is at depth ${wp.depth} — it can occlude an actor`);
  if (wp.depth <= R.cfg.envLightDepth) fails.push(`the wall panel at ${wp.x},${wp.y} is at depth ${wp.depth}, at or under the light layer`);
}

// 3 — layer separation
if (R.layer.envPartCount < 20) fails.push(`the hangar's emissive layer has only ${R.layer.envPartCount} parts`);
if (R.layer.anyEnvInRoomLayer) fails.push('an emissive object is inside roomLayer — LIGHTS OUT will tint the room light toward black');
if (R.layer.anyEnvHasBody) fails.push('an emissive object has a physics body');
if (!R.layer.allEnvAdditive) fails.push('an emissive object is not ADD-blended');
if (!eq(R.layer.envDepths, [R.cfg.envLightDepth])) fails.push(`hangar emissive depths are ${JSON.stringify(R.layer.envDepths)}`);
// NO HERO-PROP FACES HERE. The face exemption exists for one large opaque
// prop in one room; the hangar's landmark is part of the wall and needs none.
if (R.layer.faceCount !== 0) fails.push(`the hangar built ${R.layer.faceCount} emissive faces — the face exemption is the chamber's`);
if (!eq(R.layer.loClasses, ['console', 'floor', 'prop'])) fails.push(`hangar material classes are ${JSON.stringify(R.layer.loClasses)}`);

// 4 — power
if (!R.power.anyOffAtNormal) fails.push('no hangar source is dark at normal power and lit under emergency — the second state is a dimmer');
if (!R.power.anyBrighterInDark) fails.push('no hangar source gets brighter when the room loses power');
if (!R.power.restoresExactly) fails.push('hangar emissive alphas did not return to their normal-power values after an outage');
if (!R.power.clearRestoresExactly) fails.push('_clearLightsOut left the hangar emissive layer at the wrong intensity');
if (!R.power.noStaleGlow) fails.push('stale glow in the hangar after restore');
if (!R.spec.anySpecOffAtNormal) fails.push('the hangar spec declares no emergency-only source');
if (R.spec.ledsLouderInDark) fails.push('a hangar status lamp gets louder in the dark — every LED coming on is the thing to avoid');

// 5 — lifecycle, including a round trip through the other styled arena
if (R.leak.partsAfter !== R.leak.partsBefore) fails.push(`hangar emissive parts drifted across loads: ${R.leak.partsBefore} -> ${R.leak.partsAfter}`);
if (R.leak.chamberParts < 20) fails.push(`the chamber built ${R.leak.chamberParts} parts when loaded between hangars`);
if (R.leak.glowTexAfter !== R.leak.glowTexBefore || R.leak.glowTexAfter !== 3) {
  fails.push(`glow textures: ${R.leak.glowTexBefore} -> ${R.leak.glowTexAfter}, expected a constant 3`);
}
if (R.leak.orphanAdditive !== R.leak.partsAfter) {
  fails.push(`${R.leak.orphanAdditive} additive objects at the env-light depth but the layer owns ${R.leak.partsAfter} — a previous room's lights survived`);
}
if (R.leak.wallBodiesAfter !== 13) fails.push(`after four room loads the walls group holds ${R.leak.wallBodiesAfter} bodies`);

// 6 — the cover kit is honest
const KIT_TEX = ['ch-con-ped-a', 'ch-con-ped-b', 'ch-con-ped-c', 'ch-con-heavy', 'ch-con-wall', 'ch-crate-a', 'ch-crate-b'];
if (R.spec.coverTex.some((t) => !KIT_TEX.includes(t))) fails.push(`the hangar stands on non-kit cover art: ${[...new Set(R.spec.coverTex)].join(', ')}`);
const used = [...new Set(R.spec.coverTex)];
if (used.length < 3) fails.push(`the hangar uses ${used.length} cover textures — eight clones is not a kit`);
// EVERY ARCHETYPE IS ONE FOOTPRINT. The collision contract.
const bush = R.kit.texSizes.find((t) => t.k === 'bush');
for (const t of R.kit.texSizes) {
  if (t.w !== bush.w || t.h !== bush.h) fails.push(`cover texture ${t.k} is ${t.w}x${t.h}, but the footprint contract is ${bush.w}x${bush.h}`);
}
for (const b of R.geom.bodies.filter((x) => x.bw === 70)) {
  if (b.dw !== bush.w || b.dh !== bush.h) fails.push(`cover at ${b.x},${b.y} renders ${b.dw}x${b.dh}`);
}
// CARGO IS UNPOWERED MASS. A crate declares no light and must take the prop
// tint; a console declares light and must take the console tint. Both are
// derived from the kit rather than from a name list, and this is that proof.
for (const b of R.geom.bodies.filter((x) => x.bw === 70)) {
  const lit = ['ch-con-ped-a', 'ch-con-ped-b', 'ch-con-ped-c', 'ch-con-heavy'].includes(b.tex);
  const want = lit ? 'console' : 'prop';
  if (b.loClass !== want) fails.push(`cover ${b.tex} at ${b.x},${b.y} is tagged '${b.loClass}', expected '${want}'`);
}
const crates = R.spec.coverTex.filter((t) => t.startsWith('ch-crate')).length;
if (crates < 3) fails.push(`only ${crates} of the hangar's eight cover objects are cargo — the room reads as a control suite`);
if (R.kit.derived.length < 6) fails.push(`the kit derived only ${R.kit.derived.length} sources for the hangar's consoles`);
if (R.kit.propKit.length < 2) fails.push('the wall control panels contributed no light');
for (const e of [...R.kit.derived, ...R.kit.propKit]) {
  const nearCover = R.spec.cover.some((c) => Math.abs(c.x - e.x) <= 60 && Math.abs(c.y - e.y) <= 60);
  const nearPanel = R.spec.looseProps.some((p) => Math.abs(p.x - e.x) <= 60 && Math.abs(p.y - 56 - e.y) <= 60);
  if (!nearCover && !nearPanel) fails.push(`a derived ${e.kind} source at ${e.x},${e.y} is not on any cover object`);
}

// 7 — NO RED IN THE ENVIRONMENT. Amber is not red; the self-test proves the
// threshold discriminates before it is trusted on the room's own colours.
const isDangerRed = (c) => c.r > 60 && c.g < c.r * 0.42 && c.b < c.r * 0.42;
for (const known of [{ r: 255, g: 42, b: 24 }, { r: 176, g: 48, b: 48 }, { r: 138, g: 26, b: 26 }]) {
  if (!isDangerRed(known)) fails.push('the red-discipline check does not recognise red — it is decoration');
}
for (const known of [{ r: 255, g: 171, b: 82 }, { r: 106, g: 52, b: 6 }, { r: 143, g: 216, b: 255 }]) {
  if (isDangerRed(known)) fails.push('the red-discipline check flags amber or cyan — it would fail every honest palette');
}
for (const src of R.spec.emissiveColors) {
  if (isDangerRed(src)) fails.push(`RED IN THE HANGAR: a ${src.kind} source is ${src.hex}`);
}
for (const e of [...R.kit.derived, ...R.kit.propKit]) {
  for (const c of e.colors) if (isDangerRed(c)) fails.push(`RED COVER LIGHT: a ${e.kind} source is ${c.hex}`);
}

// 8 — NO BAKED STRIP LIGHTS. The single loudest thing in every baseline frame.
if (R.spec.stripEvery !== 0) fails.push(`the hangar still bakes strip lights every ${R.spec.stripEvery}px into its floor`);

// 9 — THE HANGAR IS NOT THE CHAMBER, and the chamber is not the hangar.
if (R.spec.perimeterStyle !== 'hangar') fails.push(`the hangar's perimeter style is '${R.spec.perimeterStyle}'`);
if (R.spec.perimeterStyle === R.chamber.perimeterStyle) fails.push('both styled arenas are using the same wall');
if (!R.spec.perimeterFeatures.some((f) => f.kind === 'blastdoor')) fails.push('the hangar declares no hero wall feature');
if (R.spec.propFaces !== 0) fails.push(`the hangar carries ${R.spec.propFaces} hero-machine emissive faces`);
if (R.spec.solidProps.some((p) => p.tex.startsWith('prop-pod'))) fails.push('the hero machine has been copied into the hangar');
if (R.spec.architectureLen < 15) fails.push(`the hangar has only ${R.spec.architectureLen} authored floor forms`);
// Its floor vocabulary must include primitives the chamber does not use, or the
// second room is the first room's composition with different numbers.
for (const k of ['track', 'hatch']) {
  if (!R.spec.architectureKinds.includes(k)) fails.push(`the hangar floor uses no '${k}' — its deck language is the chamber's`);
}
if (R.spec.architectureKinds.includes('dais') || R.spec.architectureKinds.includes('trench')) {
  fails.push(`the hangar reuses the chamber's own forms: ${R.spec.architectureKinds.join(', ')}`);
}
// And the chamber itself is untouched.
for (const k of Object.keys(CHAMBER)) {
  if (!eq(R.chamber[k], CHAMBER[k])) fails.push(`VADER CHAMBER MOVED: ${k} = ${JSON.stringify(R.chamber[k])}, frozen ${JSON.stringify(CHAMBER[k])}`);
}

// 10 — LIGHTS OUT's clocks, and the debug contract
if (R.cfg.onsetMs !== 140 || R.cfg.restoreMs !== 420) fails.push('LIGHTS OUT timings moved');
if (R.cfg.lightsReentryMs !== 14000) fails.push(`lightsReentryMs is ${R.cfg.lightsReentryMs}, was 14000`);
if (R.debug.roomAfter !== 'hangar' || R.debug.roomBefore !== 'hangar') {
  fails.push(`spawning Vader changed the room: ${R.debug.roomBefore} -> ${R.debug.roomAfter}`);
}
if (!R.debug.bossAlive) fails.push('Vader did not spawn in the hangar');
if (R.debug.boundsAfter.w !== 1600 || R.debug.boundsAfter.h !== 1400) fails.push('spawning Vader changed the arena bounds');

if (errors.length) fails.push(`page errors: ${errors.join(' | ')}`);
console.log(fails.length ? `\nFAIL:\n - ${fails.join('\n - ')}` : '\nPASS: the hangar is art — its geometry, its collision, the chamber and the darkness owner are untouched');
await browser.close();
process.exit(fails.length ? 1 : 0);
