// THE THIRD ARENA'S STRUCTURAL TRUTHS.
//
// `smoke-arena` protects the Vader chamber and `smoke-hangar` the hangar. This
// protects the reactor junction, and it is here for a third reason again.
//
// The chamber was a PILOT — could the language exist at all. The hangar was a
// GENERALIZATION TEST — did it survive a second, differently-shaped open room.
// The junction is a SPATIAL test: the room is 1400x1400, the only SQUARE arena
// in the game, with the objective dead centre, three feeder gates on three
// different walls and no long axis to compose along. Both approved rooms are
// axial. So what has to hold here is not only "the room is still art" but
// "a room that could not reuse either composition still reused every rule".
//
// What it protects, and why each one is here rather than assumed:
//
//   1. GAMEPLAY GEOMETRY IS UNCHANGED. Bounds, the three solid prop bodies,
//      spawn, exit, gates, terminals, pickups, the enemy list. The art pass is
//      painted art, so the only way it can regress the game is by becoming
//      collision. COVER POSITIONS ARE NOT IN THAT LIST ANY MORE — see 12.
//   2. NO ENVIRONMENT ART BECAME A PHYSICS BODY. `walls` must hold exactly 8
//      — 5 cover + 3 solid props. The two wall control panels are decoration
//      and must NOT be in it.
//   3. THE EMISSIVE LAYER IS OUTSIDE `roomLayer`, ADD-blended, at the light
//      depth, and owns no physics body. AND IT CARRIES NO FACES AT ALL: the
//      face exemption belongs to a prop whose disappearance would erase the
//      room's identity, and this room's identity in the dark is architecture.
//      Copying the hero machine's or the shuttle's pattern onto the reactor
//      core would be the third room proving nothing.
//   4. THE POWER STATE RESTORES EXACTLY, through an outage and through a room
//      torn down mid-outage.
//   5. NOTHING LEAKS ACROSS ROOM LOADS, including handing the layer back and
//      forth with the other two styled arenas.
//   6. MOST OF THIS ROOM'S COVER GOES OUT. Five of the eight cover objects
//      declare no light and take the unpowered tint. That ratio is the whole
//      reason the dark state is dark, and it is the fix for a baseline that
//      stood eight identical lit consoles in a ring around the objective.
//   7. THE COVER KIT IS HONEST. Every archetype standing here renders at
//      `bush`'s footprint over a 70x70 body — the collision contract.
//   8. NO RED IN THE ENVIRONMENT, channel-tested with the amber self-test.
//   9. NINE FULL-WIDTH ORANGE-RED BARS AND TWO TELEGRAPH-SHAPED RINGS ARE
//      GONE, and cannot come back: `stripEvery` is 0 and no floor mark is a
//      ring or a pad.
//  10. THE JUNCTION IS NEITHER APPROVED ROOM. Not their perimeter styles, not
//      their landmark props, not their emissive faces, and it carries its own
//      recessed primitive rather than the chamber's trench or the hangar's
//      track.
//  11. THE HANGAR, THE CHAMBER AND DETENTION ARE UNCHANGED, read from the same
//      place as everything else.
//  12. THE RING IS GONE AND CANNOT COME BACK. Handset play rejected the eight
//      -cover circle this room inherited, so its positions are no longer
//      frozen literals — freezing coordinates is what protected the bad
//      topology in the first place. What is asserted instead are the four
//      RELATIONAL truths the new layout is actually built on:
//
//        OPEN CENTRE   no solid body may intersect the crossing, the 600x600
//                      raised region the floor art already declares as the
//                      junction. All eight ring pieces sat inside it.
//        LANE          every pair of interior bodies is at least 160px apart.
//                      That is Ø112 (BOSS.radius doubled — the largest body in
//                      the game) plus NavGrid's own 23px agent clearance on
//                      each side, rounded to two nav cells. The ring's tightest
//                      gaps were 90px: the nav grid routed small actors through
//                      slots Vader could not physically enter, which is what
//                      "the boss fights the furniture" looks like from inside.
//        NOT A RING    the pieces may not be equidistant from the objective and
//                      may not be evenly spread around it. Deleting four of
//                      eight and keeping a tidy square would pass every other
//                      check here.
//        ACCESS        every feeder gate reaches the objective, and the spawn
//                      reaches the exit, at a near-straight nav path ratio.
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
  const spec = ROOMS.find((r) => r.id === 'corridor');
  const hangar = ROOMS.find((r) => r.id === 'hangar');
  const chamber = ROOMS.find((r) => r.boss);
  const detention = ROOMS.find((r) => r.id === 'detention');
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
    perimeterThickness: spec.perimeter?.thickness ?? null,
    perimeterFeatures: (spec.perimeter?.features || []).map((f) => ({ kind: f.kind, side: f.side, at: f.at })),
    propFaces: (spec.props || []).reduce((n, p) => n + (p.faces || []).length, 0),
    architectureKinds: [...new Set((spec.floor?.architecture || []).map((a) => a.kind))].sort(),
    architectureLen: (spec.floor?.architecture || []).length,
    stripEvery: spec.floor?.stripEvery,
    accentEvery: spec.floor?.accentEvery,
    markKinds: [...new Set((spec.floor?.marks || []).map((m) => m.kind))].sort(),
    emissiveCount: (spec.emissives || []).length,
    emissiveColors: (spec.emissives || []).flatMap((e) => cols(e).map((c) => ({ kind: e.kind, ...c }))),
    // Two independent intensities, read straight off the spec.
    anySpecOffAtNormal: (spec.emissives || []).some((e) => (e.normal ?? 0) === 0 && (e.emergency ?? 0) > 0.1),
    ledsLouderInDark: (spec.emissives || []).filter((e) => e.kind === 'led')
      .some((e) => (e.emergency ?? 0) > (e.normal ?? 0) + 1e-6),
    // THE UNPOWERED SHARE. A cover texture that is not in the kit contributes
    // no light and takes the `prop` LIGHTS OUT tint.
    // The same test `loadRoom` uses, not a near-miss of it: `bush` names no
    // texture at all and stays a console, which is what keeps the unstyled
    // arenas where they are.
    unpoweredCover: spec.cover.filter((c) => c.tex && !CONSOLE_KIT[c.tex]).length,
  };

  // ── THE OTHER THREE ROOMS, READ FROM THE SAME PLACE. This pass may not have
  //    moved any of them.
  const shape = (r) => ({
    coverTex: [...new Set((r.cover || []).map((c) => c.tex ?? r.coverTex ?? 'bush'))].sort(),
    cover: (r.cover || []).map((c) => ({ x: c.x, y: c.y })),
    perimeterStyle: r.perimeter?.style ?? null,
    perimeterThickness: r.perimeter?.thickness ?? null,
    props: (r.props || []).map((p) => ({ x: p.x, y: p.y, tex: p.tex, bodyW: p.bodyW ?? null, bodyH: p.bodyH ?? null })),
    propFaces: (r.props || []).reduce((n, p) => n + (p.faces || []).length, 0),
    emissiveCount: (r.emissives || []).length,
    architectureLen: (r.floor?.architecture || []).length,
    stripEvery: r.floor?.stripEvery ?? null,
    bounds: r.bounds,
  });
  out.hangar = shape(hangar);
  out.chamber = shape(chamber);
  out.detention = shape(detention);

  out.cfg = {
    onsetMs: LIGHTSOUT.onsetMs, restoreMs: LIGHTSOUT.restoreMs,
    lightsReentryMs: ENDLESS.bossMech.lightsReentryMs,
    envLightDepth: ENV_LIGHT_DEPTH,
    // Frozen by handset verdict. The junction raised none of them.
    lo: { floor: LIGHTSOUT.floor, wall: LIGHTSOUT.wall, prop: LIGHTSOUT.prop, console: LIGHTSOUT.console },
  };

  // ── Load the junction for real, at a late sector.
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
    navBlocked: gs.navGrid?.blockedCount?.() ?? null,
    bodies: wallKids.map((w) => ({
      x: Math.round(w.x), y: Math.round(w.y), tex: w.texture?.key,
      bw: Math.round(w.body.width), bh: Math.round(w.body.height),
      dw: Math.round(w.displayWidth), dh: Math.round(w.displayHeight),
      loClass: w._loClass,
    })).sort((a, b) => a.x - b.x || a.y - b.y),
  };

  const roomKids = gs.roomLayer.getChildren();
  const envParts = gs.envLight?.parts || [];
  // ── TOPOLOGY. Measured off the LIVE bodies, not off the spec, so a sprite
  //    that drifted from its collider cannot hide here.
  {
    const OBJ = spec.terminals[0];
    const CROSS = { x0: 400, y0: 400, x1: 1000, y1: 1000 };
    const rects = gs.walls.getChildren().filter((o) => o.active && o.body).map((o) => ({
      x: o.body.x, y: o.body.y, w: o.body.width, h: o.body.height,
      cx: o.body.x + o.body.width / 2, cy: o.body.y + o.body.height / 2,
      sx: o.x, sy: o.y, tex: o.texture?.key,
    }));
    const inner = rects.filter((r) => r.cx > 60 && r.cx < spec.bounds.w - 60
                                   && r.cy > 60 && r.cy < spec.bounds.h - 60);
    const gap = (a, b) => Math.max(Math.abs(a.cx - b.cx) - (a.w + b.w) / 2,
                                   Math.abs(a.cy - b.cy) - (a.h + b.h) / 2);
    const pairs = [];
    for (let i = 0; i < inner.length; i++)
      for (let j = i + 1; j < inner.length; j++)
        pairs.push({ a: inner[i].tex, b: inner[j].tex, g: Math.round(gap(inner[i], inner[j])) });
    const distToRect = (px, py, r) => Math.hypot(
      Math.max(r.x - px, 0, px - (r.x + r.w)), Math.max(r.y - py, 0, py - (r.y + r.h)));

    // Bearings and radii of the COVER only — the props are room furniture the
    // ring test has no opinion about.
    const cov = inner.filter((r) => r.w === 70 && r.h === 70);
    const rad = cov.map((r) => Math.hypot(r.cx - OBJ.x, r.cy - OBJ.y));
    const ang = cov.map((r) => (Math.atan2(r.cy - OBJ.y, r.cx - OBJ.x) * 180 / Math.PI + 360) % 360)
      .sort((a, b) => a - b);
    const angGaps = ang.map((a, i) => ((ang[(i + 1) % ang.length] - a) + 360) % 360);

    const route = (a, b) => {
      const p = gs.navGrid.findPath(a.x, a.y, b.x, b.y);
      let L = 0, prev = a;
      for (const n of p) { L += Math.hypot(n.x - prev.x, n.y - prev.y); prev = n; }
      return +(L / Math.hypot(a.x - b.x, a.y - b.y)).toFixed(3);
    };

    // How much of the crossing the LARGEST actor can stand in, sampled at 20px.
    let admit = 0, total = 0;
    for (let px = CROSS.x0; px <= CROSS.x1; px += 20)
      for (let py = CROSS.y0; py <= CROSS.y1; py += 20) {
        total++;
        if (rects.every((r) => distToRect(px, py, r) >= 56)) admit++;
      }

    out.topo = {
      coverBodies: cov.length,
      inCrossing: inner.filter((r) => r.x < CROSS.x1 && r.x + r.w > CROSS.x0
                                   && r.y < CROSS.y1 && r.y + r.h > CROSS.y0)
        .map((r) => `${r.tex}@${Math.round(r.cx)},${Math.round(r.cy)}`),
      minGap: Math.min(...pairs.map((p) => p.g)),
      chokes: pairs.filter((p) => p.g > 0 && p.g < 160).map((p) => `${p.a}|${p.b} ${p.g}px`),
      clearR: Math.round(Math.min(...inner.map((r) => distToRect(OBJ.x, OBJ.y, r)))),
      radSpread: +((Math.max(...rad) - Math.min(...rad)) / (rad.reduce((s, v) => s + v, 0) / rad.length)).toFixed(3),
      maxAngGap: Math.round(Math.max(...angGaps)),
      vaderCrossing: +(100 * admit / total).toFixed(1),
      gateRoutes: spec.gates.map((g) => route(g, OBJ)),
      spawnToExit: route(spec.spawn, spec.exit),
      // Sprite and body must agree — a moved cover object may not leave its
      // collider behind.
      misaligned: cov.filter((r) => Math.abs(r.sx - r.cx) > 0.6 || Math.abs(r.sy - r.cy) > 0.6)
        .map((r) => `${r.tex} sprite ${r.sx},${r.sy} body ${r.cx},${r.cy}`),
    };
  }

  out.layer = {
    envPartCount: envParts.length,
    anyEnvInRoomLayer: envParts.some((p) => roomKids.includes(p)),
    anyEnvHasBody: envParts.some((p) => !!p.body),
    allEnvAdditive: envParts.every((p) => p.blendMode === Phaser.BlendModes.ADD),
    envDepths: [...new Set(envParts.filter((p) => !p._face).map((p) => p.depth))],
    // MUST BE ZERO. See the header: the exemption is not a template.
    faceCount: envParts.filter((p) => p._face).length,
    // No object in this room's light layer may be wearing another room's
    // landmark texture.
    envTextures: [...new Set(envParts.map((p) => p.texture?.key))].sort(),
    loClasses: [...new Set(roomKids.map((o) => o._loClass))].sort(),
    wallPanels: roomKids.filter((o) => o.texture?.key === 'ch-con-wall')
      .map((o) => ({ x: Math.round(o.x), y: Math.round(o.y), depth: o.depth, hasBody: !!o.body, loClass: o._loClass })),
    // The unpowered cover, as PLACED — the tint is derived from the kit rather
    // than from a name list, so this is the live proof of §6 above.
    unpoweredPlaced: wallKids.filter((w) => w.body.width === 70 && w._loClass === 'prop').length,
    consolePlaced: wallKids.filter((w) => w.body.width === 70 && w._loClass === 'console').length,
  };

  out.kit = {
    derived: (spec.cover || []).flatMap((cp) => consoleEmissives(cp.tex ?? 'bush', cp.x, cp.y))
      .map((e) => ({ kind: e.kind, x: Math.round(e.x), y: Math.round(e.y), normal: e.normal, emergency: e.emergency, colors: cols(e) })),
    propKit: (spec.props || []).filter((p) => p.kit)
      .flatMap((p) => consoleEmissives(p.kit, p.x, p.y - 56))
      .map((e) => ({ kind: e.kind, x: Math.round(e.x), y: Math.round(e.y), colors: cols(e) })),
    // The cabinets must NOT be in the kit. That is the mechanism, not a habit.
    cabinetsInKit: ['rj-cab-a', 'rj-cab-b'].filter((k) => !!CONSOLE_KIT[k]),
    texSizes: [...Object.keys(CONSOLE_KIT), 'rj-cab-a', 'rj-cab-b', 'bush']
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

  // ── LIFECYCLE. Three loads, and a round trip through BOTH other styled
  //    arenas, so all three have to hand the layer over cleanly.
  const partsBefore = envParts.length;
  const texBefore = window.game.textures.getTextureKeys().filter((k) => k.startsWith('env-glow-')).length;
  const displayBefore = gs.children.list.length;
  for (let i = 0; i < 2; i++) { gs.loadRoom(spec); await sleep(800); }
  gs.loadRoom(hangar); await sleep(900);
  const hangarParts = gs.envLight?.parts?.length ?? -1;
  gs.loadRoom(chamber); await sleep(900);
  const chamberParts = gs.envLight?.parts?.length ?? -1;
  gs.loadRoom(detention); await sleep(800);
  const detentionParts = gs.envLight?.parts?.length ?? -1;
  gs.loadRoom(spec); await sleep(900);
  gs.arenaActive = false;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  await sleep(200);
  out.leak = {
    partsBefore, partsAfter: gs.envLight?.parts?.length ?? -1,
    hangarParts, chamberParts, detentionParts,
    glowTexBefore: texBefore,
    glowTexAfter: window.game.textures.getTextureKeys().filter((k) => k.startsWith('env-glow-')).length,
    displayBefore, displayAfter: gs.children.list.length,
    orphanAdditive: gs.children.list.filter(
      (o) => o.blendMode === Phaser.BlendModes.ADD && (o.depth === ENV_LIGHT_DEPTH || o._face),
    ).length,
    wallBodiesAfter: gs.walls.getChildren().filter((w) => w.active).length,
  };

  // ── SPAWN VADER KEEPS THE ROOM.
  const roomBefore = gs.roomSpec?.id;
  gs.spawnBoss(700, 500);
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

const fails = [];
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── FROZEN JUNCTION GEOMETRY. Read out of the pre-pass build (0af4cf9) and
//    written here as literals on purpose: a check that derives its expectation
//    from the file it is checking cannot fail. Cover is POST-`snapAll`.
const FROZEN = {
  bounds: { w: 1400, h: 1400 },
  spawn: { x: 200, y: 1200 },
  exit: { x: 1200, y: 200, side: 'top' },
  gates: [{ x: 700, y: 100 }, { x: 100, y: 700 }, { x: 1300, y: 700 }],
  terminals: [{ x: 700, y: 700 }],
  pickups: [{ x: 700, y: 1160, weapon: 'rifle' }],
  enemies: [
    { type: 'grunt', x: 450, y: 450 }, { type: 'grunt', x: 1080, y: 1080 },
    { type: 'bomber', x: 1150, y: 350 }, { type: 'sniper', x: 700, y: 350 },
    { type: 'shooter', x: 350, y: 1050 },
  ],
  solidProps: [
    { x: 260, y: 400, tex: 'prop-core', bodyW: 200, bodyH: 120 },
    { x: 1150, y: 1180, tex: 'prop-strut', bodyW: 190, bodyH: 60 },
    { x: 1230, y: 480, tex: 'prop-strut', bodyW: 190, bodyH: 60 },
  ],
  wallsLen: 0,
};
for (const k of Object.keys(FROZEN)) {
  if (!eq(R.spec[k], FROZEN[k])) fails.push(`JUNCTION GEOMETRY MOVED: spec.${k} = ${JSON.stringify(R.spec[k])}`);
}
if (R.geom.worldBounds.w !== 1400 || R.geom.worldBounds.h !== 1400) fails.push(`arena bounds are ${R.geom.worldBounds.w}x${R.geom.worldBounds.h}`);
if (R.geom.cameraBounds.w !== 1400 || R.geom.cameraBounds.h !== 1400) fails.push('camera bounds no longer match the arena');

// 2 — nothing painted became collision. 5 cover + 3 solid props.
if (R.geom.wallBodies !== 7) fails.push(`walls group holds ${R.geom.wallBodies} bodies, expected 7 (4 cover + 3 solid props)`);
if (R.geom.losRects !== 7) fails.push(`losRects is ${R.geom.losRects}, expected 7`);
if (R.geom.bodies.filter((b) => b.bw === 70 && b.bh === 70).length !== 4) {
  fails.push(`expected 4 cover bodies at 70x70, found ${R.geom.bodies.filter((b) => b.bw === 70 && b.bh === 70).length}`);
}
for (const b of R.geom.bodies) {
  if (b.tex === 'ch-con-wall') fails.push(`a wall control panel became a physics body at ${b.x},${b.y}`);
}
if (R.layer.wallPanels.length !== 2) fails.push(`expected 2 wall control panels in the room layer, found ${R.layer.wallPanels.length}`);
for (const wp of R.layer.wallPanels) {
  if (wp.hasBody) fails.push(`the wall panel at ${wp.x},${wp.y} has a physics body`);
  if (wp.depth >= 90) fails.push(`the wall panel at ${wp.x},${wp.y} is at depth ${wp.depth} — it can occlude an actor`);
  if (wp.depth <= R.cfg.envLightDepth) fails.push(`the wall panel at ${wp.x},${wp.y} is at depth ${wp.depth}, at or under the light layer`);
}

// 3 — layer separation, and NO FACES.
if (R.layer.envPartCount < 20) fails.push(`the junction's emissive layer has only ${R.layer.envPartCount} parts`);
if (R.layer.anyEnvInRoomLayer) fails.push('an emissive object is inside roomLayer — LIGHTS OUT will tint the room light toward black');
if (R.layer.anyEnvHasBody) fails.push('an emissive object has a physics body');
if (!R.layer.allEnvAdditive) fails.push('an emissive object is not ADD-blended');
if (!eq(R.layer.envDepths, [R.cfg.envLightDepth])) fails.push(`junction emissive depths are ${JSON.stringify(R.layer.envDepths)} — everything here should be at the light depth`);
if (R.layer.faceCount !== 0) fails.push(`the junction built ${R.layer.faceCount} emissive faces — the face exemption belongs to a prop whose loss would erase a room's identity, and this room's dark identity is its architecture`);
if (R.spec.propFaces !== 0) fails.push(`the junction spec declares ${R.spec.propFaces} prop faces`);
for (const t of R.layer.envTextures) {
  if (/^prop-pod|^prop-shuttle/.test(t || '')) fails.push(`COPIED: the junction's light layer is wearing ${t}`);
}

// 4 — power determinism
if (!R.spec.anySpecOffAtNormal) fails.push('no junction source is dead at normal power — this is a dimmer, not a second authored state');
if (!R.power.anyOffAtNormal) fails.push('no emissive part actually came up on the emergency bus at runtime');
if (!R.power.restoresExactly) fails.push('the emissive layer does not return to its authored normal-power alphas after an outage');
if (!R.power.clearRestoresExactly) fails.push('_clearLightsOut leaves the emissive layer at the wrong alphas');
if (!R.power.noStaleGlow) fails.push('an emissive part is brighter after restore than it was before the outage');
if (R.spec.ledsLouderInDark) fails.push('a nominal lamp gets louder in the dark — a lamp that says "fine" has no reason to shout');

// 5 — lifecycle
if (R.leak.partsAfter !== R.leak.partsBefore) fails.push(`emissive parts drifted across room loads: ${R.leak.partsBefore} -> ${R.leak.partsAfter}`);
if (R.leak.glowTexAfter !== R.leak.glowTexBefore) fails.push('the shared glow textures were re-created on a room load');
if (R.leak.orphanAdditive !== R.leak.partsAfter) fails.push(`${R.leak.orphanAdditive} additive environment objects are drawing but the layer owns ${R.leak.partsAfter}`);
if (R.leak.wallBodiesAfter !== 7) fails.push(`after five room loads the walls group holds ${R.leak.wallBodiesAfter} bodies`);
if (R.leak.detentionParts !== 0) fails.push(`detention built ${R.leak.detentionParts} emissive parts — it is not in any of this`);
if (R.leak.hangarParts < 20 || R.leak.chamberParts < 20) fails.push('an approved arena came back from a junction round trip with an empty light layer');

// 6 — MOST OF THIS ROOM'S COVER GOES OUT. Three of five now rather than five
//     of four now rather than five of eight, and ONE lit cover object in the
//     whole room instead of three standing in a circle. A larger majority than
//     before, through a topology change that removed half the objects.
if (R.spec.unpoweredCover !== 3) fails.push(`${R.spec.unpoweredCover} of 4 cover objects are unpowered, expected 3 — the dark state depends on that ratio`);
if (R.layer.unpoweredPlaced !== 3) fails.push(`${R.layer.unpoweredPlaced} placed cover objects took the unpowered tint, expected 3`);
if (R.layer.consolePlaced !== 1) fails.push(`${R.layer.consolePlaced} placed cover objects took the console tint, expected 1`);
if (R.kit.cabinetsInKit.length) fails.push(`the service cabinets are IN the console kit (${R.kit.cabinetsInKit}) — that is what makes them stay lit in a blackout`);

// 7 — the cover kit's footprint contract
const bush = R.kit.texSizes.find((t) => t.k === 'bush');
if (!bush) fails.push('bush is not painted — the footprint contract has nothing to measure against');
else for (const t of R.kit.texSizes) {
  if (t.w !== bush.w || t.h !== bush.h) fails.push(`${t.k} renders at ${t.w}x${t.h}, bush is ${bush.w}x${bush.h} — a cover archetype may not change its footprint`);
}
for (const b of R.geom.bodies.filter((x) => x.bw === 70)) {
  if (b.dw !== bush.w || b.dh !== bush.h) fails.push(`the cover at ${b.x},${b.y} draws at ${b.dw}x${b.dh} over a 70x70 body`);
}

// 12 — THE RING IS GONE. Four relational truths, no frozen coordinates.
//
//      Every one of them A/B's: run this against the eight-cover ring and it
//      reports 8 bodies in the crossing, a 90px minimum gap, five sub-lane
//      chokes, a 205px clear radius, a 0.201 radius spread, a 55-degree widest
//      bearing gap and 53% of the crossing closed to Vader. Eighteen findings
//      in total, measured, not estimated.
//
//      THE RADIUS BAR IS 0.25 BECAUSE THE RING SCORES 0.201. The first version
//      of this check asked for 0.2 and the eight-cover ring PASSED it — its
//      pieces sit between 254 and 311px out, which is spread enough to clear a
//      lazy threshold. A check that passes on the bug is decoration.
if (R.topo.coverBodies !== 4) fails.push(`the room stands ${R.topo.coverBodies} cover objects, the selected topology is 4`);
if (R.topo.inCrossing.length) {
  fails.push(`${R.topo.inCrossing.length} solid bodies sit inside the 600x600 crossing — it is the clear combat envelope: ${R.topo.inCrossing.join(', ')}`);
}
if (R.topo.minGap < 160) fails.push(`the tightest gap between two solid bodies is ${R.topo.minGap}px — Vader is 112px wide and the nav grid assumes 23px of clearance, so 160px is the lane`);
if (R.topo.chokes.length) fails.push(`sub-lane chokes: ${R.topo.chokes.join(', ')}`);
if (R.topo.clearR < 300) fails.push(`the nearest solid face is ${R.topo.clearR}px from the objective, wanted 300+`);
if (R.topo.vaderCrossing < 95) fails.push(`only ${R.topo.vaderCrossing}% of the crossing admits a Ø112 body`);
// NOT A RING: a ring is uniform in both radius and bearing. Five evenly spread
// pieces would leave a 72-degree widest gap and a radius spread near zero.
if (R.topo.radSpread < 0.25) fails.push(`the cover sits at a ${R.topo.radSpread} radius spread from the objective — the rejected ring scored 0.201, so this is no less uniform than the thing it replaced`);
if (R.topo.maxAngGap < 110) fails.push(`the widest bearing gap between cover pieces is ${R.topo.maxAngGap} degrees — the pieces are evenly spread around the objective, which is a ring`);
// ACCESS: 4-connected BFS cannot do better than 1.414 on a pure diagonal, so
// the spawn->exit run is judged against that floor and not against 1.0.
R.topo.gateRoutes.forEach((r, i) => {
  if (r > 1.15) fails.push(`feeder gate ${i} routes to the objective at ${r}x straight line — the approach is not clean`);
});
if (R.topo.spawnToExit > 1.5) fails.push(`spawn routes to the exit at ${R.topo.spawnToExit}x straight line (4-connected floor is 1.414)`);
if (R.topo.misaligned.length) fails.push(`cover sprite and body disagree: ${R.topo.misaligned.join('; ')}`);

// 8 — NO RED IN THE ENVIRONMENT. Amber is not red; the separator is how far
//     the green channel falls. Self-tested so the check cannot be decoration.
const isDangerRed = (c) => c.r > 60 && c.g < c.r * 0.42 && c.b < c.r * 0.42;
for (const known of [{ r: 255, g: 42, b: 24 }, { r: 176, g: 48, b: 48 }, { r: 138, g: 26, b: 26 }]) {
  if (!isDangerRed(known)) fails.push('the red-discipline check does not recognise red — it is decoration');
}
for (const known of [{ r: 255, g: 180, b: 90 }, { r: 255, g: 171, b: 82 }, { r: 138, g: 74, b: 16 }]) {
  if (isDangerRed(known)) fails.push('the red-discipline check calls amber red — it would fail the emergency fixtures');
}
for (const c of [...R.spec.emissiveColors, ...R.kit.derived.flatMap((d) => d.colors), ...R.kit.propKit.flatMap((d) => d.colors)]) {
  if (isDangerRed(c)) fails.push(`RED IN THE ENVIRONMENT: ${c.hex} on a ${c.kind ?? 'derived'} source`);
}

// 9 — the baseline's two loudest mistakes cannot come back.
if (R.spec.stripEvery !== 0) fails.push(`stripEvery is ${R.spec.stripEvery} — the full-width bars are back, and in this room they were orange-red`);
if (R.spec.accentEvery !== 0) fails.push(`accentEvery is ${R.spec.accentEvery}`);
for (const k of R.spec.markKinds) {
  if (k === 'ring' || k === 'pad') fails.push(`a '${k}' floor mark is back — a painted circle centred on the objective is the shape and placement of a circle telegraph`);
}

// 10 — THE JUNCTION IS NEITHER APPROVED ROOM.
if (R.spec.perimeterStyle === 'chamber' || R.spec.perimeterStyle === 'hangar') {
  fails.push(`COPIED: the junction is using the ${R.spec.perimeterStyle} perimeter style`);
}
if (R.spec.perimeterStyle !== 'junction') fails.push(`the junction's perimeter style is ${R.spec.perimeterStyle}`);
if (!R.spec.architectureKinds.includes('conduit')) {
  fails.push('the junction declares no conduit — its recessed primitive is what distinguishes it from the chamber trench and the hangar track');
}
if (R.spec.architectureKinds.includes('trench')) fails.push('COPIED: the junction is standing on the chamber\'s trench');
if (R.spec.architectureKinds.includes('track')) fails.push('COPIED: the junction is standing on the hangar\'s track');
if (R.spec.architectureKinds.includes('dais')) fails.push('COPIED: the junction has a boss-stage dais');
for (const p of R.spec.solidProps) {
  if (/^prop-pod|^prop-shuttle/.test(p.tex)) fails.push(`COPIED: the junction is standing on ${p.tex}`);
}
if (!R.spec.perimeterFeatures.some((f) => f.kind === 'interchange')) {
  fails.push('the junction declares no architectural landmark');
}
if (R.spec.perimeterFeatures.some((f) => f.kind === 'blastdoor')) {
  fails.push('COPIED: the junction is landmarked on the hangar\'s blast door');
}
if (R.spec.perimeterFeatures.filter((f) => f.kind === 'panelmount').length !== 2) {
  fails.push('the wall control panel archetype is not mounted twice — its second use-case is the point of putting it here');
}

// 11 — THE OTHER THREE ROOMS ARE UNCHANGED. Frozen by handset verdict on
//      0af4cf9 and written out as literals for the same reason as above.
const HANGAR = {
  coverTex: ['ch-con-heavy', 'ch-con-ped-c', 'ch-crate-a', 'ch-crate-b'],
  perimeterStyle: 'hangar', perimeterThickness: 116,
  propFaces: 2, emissiveCount: 18, architectureLen: 22, stripEvery: 0,
  bounds: { w: 1600, h: 1400 },
};
const CHAMBER = {
  coverTex: ['ch-con-heavy', 'ch-con-ped-a', 'ch-con-ped-b'],
  perimeterStyle: 'chamber', perimeterThickness: 80,
  propFaces: 2, stripEvery: 0,
  bounds: { w: 1600, h: 1600 },
};
const DETENTION = {
  coverTex: ['bush'], perimeterStyle: 'cells', perimeterThickness: 64,
  propFaces: 0, emissiveCount: 0, architectureLen: 0,
  bounds: { w: 1600, h: 1400 },
};
for (const [name, want, got] of [['hangar', HANGAR, R.hangar], ['chamber', CHAMBER, R.chamber], ['detention', DETENTION, R.detention]]) {
  for (const k of Object.keys(want)) {
    if (!eq(got[k], want[k])) fails.push(`${name.toUpperCase()} CHANGED: ${k} = ${JSON.stringify(got[k])}, expected ${JSON.stringify(want[k])}`);
  }
}
if (R.hangar.props.some((p) => p.tex === 'prop-shuttle' && (p.x !== 420 || p.y !== 470))) fails.push('the shuttle moved');
if (R.chamber.props.some((p) => p.tex === 'prop-pod' && (p.x !== 340 || p.y !== 740))) fails.push('the hero machine moved');

// 12 — LIGHTS OUT's own numbers. Frozen by handset verdict; this pass raised
//      none of them, which is the same restraint the arena pilot showed after
//      trying to.
const LO = { floor: 0x12151f, wall: 0x1a1f2b, prop: 0x2e3446, console: 0x8892ac };
for (const k of Object.keys(LO)) {
  if (R.cfg.lo[k] !== LO[k]) fails.push(`LIGHTS OUT ${k} tint moved to 0x${(R.cfg.lo[k] || 0).toString(16)} — making architecture readable in the dark is how emergency power becomes "the normal room, dimmer"`);
}

// 13 — the debug contract
if (R.debug.roomAfter !== R.debug.roomBefore) fails.push(`spawning Vader changed the room: ${R.debug.roomBefore} -> ${R.debug.roomAfter}`);
if (!R.debug.bossAlive) fails.push('spawnBoss produced no boss — the checks around it prove nothing');
if (R.debug.boundsAfter.w !== 1400 || R.debug.boundsAfter.h !== 1400) fails.push('spawning Vader changed the world bounds');

if (errors.length) fails.push(`page errors: ${errors.join(' | ')}`);

await browser.close();
if (fails.length) {
  console.error('\nFAIL:'); for (const f of fails) console.error('  -', f);
  process.exit(1);
}
console.log('\nsmoke-junction OK');
