// SMOKE — THE DETENTION BLOCK, the fourth arena's structural truths.
//
//   node tests/smoke-detention.mjs
//
// WHAT THIS PROTECTS, AND WHAT IT DELIBERATELY DOES NOT. Every check here is
// a structure, a contract or a measurable relationship. NONE of them is an
// artistic coordinate or a glow intensity: a human decides how bright the
// locks are, and a test that froze that number would make the next handset
// verdict unimplementable. What a test can hold is that the room the human
// approved is still the room that loads.
//
// THE FOUR CLASSES OF CHECK:
//   FROZEN GAMEPLAY   bounds, spawn, exit, gates, terminals, the empty wall
//                     list, the eight cover positions and the five prop bodies
//                     — none of which this art pass was allowed to move.
//   NO FAKE SOLIDS    every cover texture is the same size as `bush` and every
//                     body is the frozen 70x70, so nothing promises cover the
//                     room does not have.
//   THE AUTHORED ROOM the architecture opt-in, the perimeter style, the
//                     landmark feature, the emissive classes, the colour rule,
//                     the empty walk, and the powered/unpowered cover ratio.
//   NO LEAKS          repeated loads do not duplicate lights, the power state
//                     restores exactly, and the three approved arenas are
//                     untouched.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const URL = 'http://localhost:5173/?nodlg=1&nofreeze=1';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
let pass = 0; const fails = [];
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fails.push(`${name} ${detail}`); console.log(`  FAIL ${name} ${detail}`); }
};

const browser = await chromium.launch({ executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
page.on('pageerror', (e) => console.error('PAGE ERROR', e));
await page.goto(URL);
await page.waitForTimeout(4500);
await page.mouse.click(360, 640);
await page.waitForTimeout(800);
await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 909 }));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(1500);

const R = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { ROOMS } = await import('/src/data/rooms.js');
  const { CONSOLE_KIT } = await import('/src/data/consoleKit.js');
  const { ENV_LIGHT_DEPTH } = await import('/src/systems/EnvLight.js');
  const spec = ROOMS.find((r) => r.id === 'detention');

  const quiet = async () => {
    gs._roomModifier = null;
    gs.events.emit('modifier-active', null, null);
    gs.arenaActive = false;
    gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
    await new Promise((r) => setTimeout(r, 1300));
    gs.arenaActive = false;
    gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  };
  const texSize = (k) => {
    const s = gs.textures.get(k)?.getSourceImage?.();
    return s ? [s.width, s.height] : null;
  };

  gs.loadRoom(spec); await quiet();

  // ── FROZEN GAMEPLAY, read off the LIVE scene rather than off the spec: the
  //    spec is the thing under edit, and a check that reads it is a check that
  //    the file says what the file says.
  const coverBodies = gs.walls.getChildren()
    .filter((w) => w.texture?.key && !String(w.texture.key).startsWith('prop-'))
    .map((w) => ({ tex: w.texture.key, x: Math.round(w.x), y: Math.round(w.y),
                   bw: w.body.width, bh: w.body.height,
                   sw: w.displayWidth, sh: w.displayHeight,
                   lo: w._loClass }))
    .sort((a, b) => (a.y - b.y) || (a.x - b.x));
  const props = gs.walls.getChildren()
    .filter((w) => String(w.texture?.key || '').startsWith('prop-'))
    .map((w) => ({ tex: w.texture.key, x: Math.round(w.x), y: Math.round(w.y),
                   bw: w.body.width, bh: w.body.height }))
    .sort((a, b) => (a.y - b.y) || (a.x - b.x));

  // ── THE EMISSIVE LAYER, described rather than sampled.
  const srcs = (spec.emissives || []).map((s) => ({
    kind: s.kind, x: s.x, y: s.y, len: s.len, t: s.t, r: s.r, w: s.w, h: s.h,
    dir: s.dir, color: s.color, hot: s.hot, normal: s.normal, emergency: s.emergency,
    emitter: s.emitter, angle: s.angle,
  }));
  // A source's spill box, in the same arithmetic EnvLight uses to size one.
  const box = (s) => {
    const reach = s.reach ?? 0;
    // A `floor` reflection states its own footprint outright — that is the
    // whole point of the kind, and why it is the only one that can be flat.
    if (s.kind === 'floor') {
      const w = s.w ?? 200, h = s.h ?? 44;
      return { x0: s.x - w / 2, x1: s.x + w / 2, y0: s.y - h / 2, y1: s.y + h / 2 };
    }
    if (s.kind === 'strip') {
      return s.dir === 'v'
        ? { x0: s.x - (s.t + reach * 2.6) / 2, x1: s.x + (s.t + reach * 2.6) / 2,
            y0: s.y - (s.len + reach) / 2, y1: s.y + (s.len + reach) / 2 }
        : { x0: s.x - (s.len + reach) / 2, x1: s.x + (s.len + reach) / 2,
            y0: s.y - (s.t + reach * 2.6) / 2, y1: s.y + (s.t + reach * 2.6) / 2 };
    }
    const rr = (s.r ?? Math.max(s.w ?? 0, s.h ?? 0) / 2) + reach;
    return { x0: s.x - rr, x1: s.x + rr, y0: s.y - rr, y1: s.y + rr };
  };
  // THE WALK'S CENTRE. This used to be the whole walk — x [300, 1280],
  // y [560, 840] — and NOTHING was allowed inside it. Handset play retired
  // that: with the camera at the room's middle the view is x [440, 1160] and
  // y [102, 1298], which puts the north bank above the frame and the south
  // bank behind the joysticks, so a rule that kept every fixture off the walk
  // kept every fixture out of the picture the fight happens in. The verdict
  // was *too black and visually empty*.
  //
  // WHAT REPLACED IT IS NARROWER AND STILL REAL. The two checkpoint consoles
  // may contaminate their own deck, because a powered machine standing on a
  // floor puts light on that floor. The CENTRE of the walk still receives
  // nothing, which is what holds a large black negative space in the middle
  // of every frame — and the width of that centre is DERIVED, not chosen:
  // x [720, 880] is 160px, the junction's lane (Ø112 boss plus NavGrid's 23px
  // agent clearance a side), which is the narrowest gap this game calls open
  // floor. Both console catches stop clear of it by more than a body width.
  const inCore = (spec.emissives || []).filter((s) => {
    const b = box(s);
    return b.y1 > 560 && b.y0 < 840 && b.x1 > 720 && b.x0 < 880;
  }).length;
  // THE CHECK THAT WOULD HAVE CAUGHT THE COMPLAINT. Everything above says
  // where light may NOT go; this one says the frame the fight happens in is
  // not empty. At the centre station the camera shows x [440, 1160] and
  // y [102, 1298]; count the authored sources whose spill lands inside it.
  // On the build the handset rejected this was ONE — the west checkpoint
  // console's own kit light — and the verdict was *too black and visually
  // empty*. A room that passes every negative rule and puts nothing in the
  // player's own frame has satisfied the rules and lost the argument.
  // Presence is not the measure — the rejected build had sources overlapping
  // that rectangle too, at a reach that put almost nothing inside it. What is
  // measured is the EMERGENCY LIGHT BUDGET: each source's emergency intensity
  // times the area of its spill that actually falls in the view, in square
  // megapixels of world.
  const inCentreView = +((spec.emissives || []).reduce((acc, s) => {
    const b = box(s);
    const w = Math.max(0, Math.min(b.x1, 1160) - Math.max(b.x0, 440));
    const h = Math.max(0, Math.min(b.y1, 1298) - Math.max(b.y0, 102));
    return acc + (s.emergency ?? 0) * w * h;
  }, 0) / 1e6).toFixed(3);

  // Everything the walk DOES receive has to be received light, not a fixture:
  // `emitter: false` means the source draws its soft box and no `TEX_FLAT`
  // bar, so there is no hard edge anywhere on the deck and nothing can read as
  // a painted mark. A lit bar lying on the escort floor is the full-width cyan
  // strips this room was built to remove.
  const onWalk = (spec.emissives || []).filter((s) => {
    const b = box(s);
    return b.y1 > 560 && b.y0 < 840 && b.x1 > 300 && b.x0 < 1280;
  });
  // `floor` is never an emitter BY CONSTRUCTION — the kind builds one soft box
  // and has no `TEX_FLAT` branch at all — so it needs no opt-out to qualify.
  const walkEmitters = onWalk.filter((s) => s.emitter !== false && s.kind !== 'floor').length;
  // THE FLOOR IS NOT GLOWING, IT IS CATCHING. Every received-light entry in
  // the room is a spill with no emitter of its own.
  const catches = (spec.emissives || []).filter((s) => s.emitter === false || s.kind === 'floor');
  const catchEmitters = catches.filter((s) => s.kind !== 'strip' && s.kind !== 'floor').length;

  // ── THE FLOOR REFLECTIONS. A separate class from the hazes above them, and
  //    the separation is GEOMETRIC. A `strip`'s spill is `len + reach` by
  //    `t + reach * 2.6`, so its softness inflates both axes and a wide soft
  //    catch is necessarily a tall one — which is why fourteen of them landed
  //    as atmosphere over the deck and came back from the handset as *the
  //    hazes are cool, but the floor still feels dead*. A surface reflection
  //    is FLAT. These assert that it stayed flat, and that it stayed a
  //    reflection rather than becoming a second set of fixtures.
  const refl = (spec.emissives || []).filter((s) => s.kind === 'floor');
  const reflFat = refl.filter((s) => {
    const w = s.w ?? 200, h = s.h ?? 44;
    return Math.max(w, h) / Math.max(1, Math.min(w, h)) < 3.2;
  }).length;
  const reflLit = refl.filter((s) => (s.normal ?? 0) > 0).length;
  // NOT A RUNWAY: no two reflections may share a footprint, and none may be
  // long enough to cross the room. A repeated size at a repeating interval is
  // what a lane is made of.
  const reflSizes = new Set(refl.map((s) => `${s.w ?? 200}x${s.h ?? 44}`));
  const reflLongest = Math.max(0, ...refl.map((s) => Math.max(s.w ?? 200, s.h ?? 44)));

  // ── POWER. Cycle it and prove the alphas come back.
  const before = gs.envLight.parts.map((p) => +p.alpha.toFixed(4));
  gs.envLight.setPower(1);
  const dark = gs.envLight.parts.map((p) => +p.alpha.toFixed(4));
  gs.envLight.setPower(0);
  const after = gs.envLight.parts.map((p) => +p.alpha.toFixed(4));

  // ── LEAK. Five more loads, then a tour, then back.
  const partSeq = [];
  for (let i = 0; i < 4; i++) { gs.loadRoom(spec); await quiet(); partSeq.push(gs.envLight.parts.length); }
  const others = {};
  for (const id of ['hangar', 'corridor', 'vader']) {
    gs.loadRoom(ROOMS.find((r) => r.id === id)); await quiet();
    others[id] = {
      parts: gs.envLight.parts.length,
      faces: gs.envLight.parts.filter((p) => p._face).length,
      // THE OVERLAY IS DETENTION'S. Two of the three consoles wearing one are
      // SHARED archetypes standing in the approved arenas; the face is opted
      // into per PLACEMENT, so no other room may be carrying a `dt-face-`.
      faceTex: gs.envLight.parts.filter((p) => p._face).map((p) => p.texture.key),
      bodies: gs.walls.getChildren().length,
      style: ROOMS.find((r) => r.id === id).perimeter?.style,
    };
  }
  gs.loadRoom(spec); await quiet();

  return {
    id: gs.roomSpec.id,
    bounds: { w: gs.physics.world.bounds.width, h: gs.physics.world.bounds.height },
    spawn: spec.spawn, exit: spec.exit,
    gates: spec.gates, terminals: spec.terminals,
    wallsDeclared: (spec.walls || []).length,
    coverBodies, props,
    solids: gs.walls.getChildren().length,
    bushSize: texSize('bush'),
    perimeter: { style: spec.perimeter?.style, t: spec.perimeter?.thickness,
                 features: (spec.perimeter?.features || []).map((f) => f.kind) },
    arch: {
      n: (spec.floor?.architecture || []).length,
      kinds: [...new Set((spec.floor?.architecture || []).map((a) => a.kind))],
      stripEvery: spec.floor?.stripEvery, accentEvery: spec.floor?.accentEvery,
      markKinds: [...new Set((spec.floor?.marks || []).map((m) => m.kind))],
      grounded: !!spec.floor?.grounded,
    },
    srcs, onWalk: onWalk.length, inCore, walkEmitters, inCentreView,
    refl: refl.length, reflFat, reflLit, reflSizes: reflSizes.size, reflLongest,
    catches: catches.length, catchEmitters,
    kitPowered: coverBodies.filter((c) => !!CONSOLE_KIT[c.tex]).length,
    parts: gs.envLight.parts.length,
    faces: gs.envLight.parts.filter((p) => p._face).length,
    // ── THE POWERED CONSOLE FACES, MEASURED ON THE LIVE OBJECTS.
    //    A face is the one thing in the emissive layer allowed above depth 3,
    //    and the entire argument for that exemption is CONTAINMENT: its
    //    rectangle is its host's rectangle, so every pixel it can reach is a
    //    pixel the host already covers opaquely. Asserted, not assumed.
    faceDetail: gs.envLight.parts.filter((p) => p._face).map((p) => {
      const b = p.getBounds();
      const host = gs.roomLayer.getChildren()
        .filter((o) => o.texture && o.getBounds)
        .map((o) => ({ o, hb: o.getBounds() }))
        .find(({ hb }) => Math.abs(hb.centerX - b.centerX) < 2
                       && Math.abs(hb.centerY - b.centerY) < 2
                       && hb.width >= b.width - 1 && hb.height >= b.height - 1);
      return {
        tex: p.texture.key,
        hostTex: host ? host.o.texture.key : null,
        // Exactly its host's depth plus one: high enough to be seen on the
        // object, low enough that an actor standing in front of the console
        // still draws over it.
        onHost: host ? p.depth === host.o.depth + 1 : false,
        additive: p.blendMode === Phaser.BlendModes.ADD,
        normal: p._normal, emergency: p._emergency,
      };
    }),
    // From the SPEC, so the powered/unpowered asymmetry is checked where it is
    // authored rather than inferred from what happened to be built.
    coverFaces: (spec.cover || []).map((c) => ({
      tex: c.tex, powered: !!CONSOLE_KIT[c.tex], faces: (c.faces || []).length,
    })),
    envDepth: ENV_LIGHT_DEPTH,
    minPartDepth: Math.min(...gs.envLight.parts.map((p) => p.depth)),
    inRoomLayer: gs.envLight.parts.filter((p) => gs.roomLayer.contains(p)).length,
    playerDepth: gs.player.depth,
    power: { before, dark, after },
    partSeq, others,
    dtSizes: { bench: texSize('dt-bench'), benchB: texSize('dt-bench-b'), lock: texSize('dt-con-lock') },
  };
});

console.log('\n── THE ROOM THAT LOADED ──────────────────────────────────────');
ok('the detention block is what loaded', R.id === 'detention', R.id);
ok('bounds are the frozen 1600x1400', R.bounds.w === 1600 && R.bounds.h === 1400, JSON.stringify(R.bounds));

console.log('\n── FROZEN GAMEPLAY GEOMETRY ──────────────────────────────────');
ok('spawn is unmoved at (150, 700)', R.spawn.x === 150 && R.spawn.y === 700, JSON.stringify(R.spawn));
ok('the exit is unmoved at (1450, 700) right', R.exit.x === 1450 && R.exit.y === 700 && R.exit.side === 'right', JSON.stringify(R.exit));
ok('four gates, unmoved', R.gates.length === 4
  && R.gates.some((g) => g.x === 800 && g.y === 100) && R.gates.some((g) => g.x === 800 && g.y === 1300)
  && R.gates.some((g) => g.x === 1450 && g.y === 300) && R.gates.some((g) => g.x === 1450 && g.y === 1100),
  JSON.stringify(R.gates));
ok('two objectives, unmoved', R.terminals.length === 2
  && R.terminals.some((t) => t.x === 500 && t.y === 450)
  && R.terminals.some((t) => t.x === 1100 && t.y === 950), JSON.stringify(R.terminals));
ok('the wall list is still EMPTY — this deck has no structure on it', R.wallsDeclared === 0, String(R.wallsDeclared));
ok('eight cover objects, no more and no fewer', R.coverBodies.length === 8, String(R.coverBodies.length));
{
  const want = [[400, 300], [800, 300], [1200, 300], [600, 700], [1000, 700], [400, 1100], [800, 1100], [1200, 1100]];
  // Positions are `snapAll`ed, so compare within the snap grid rather than
  // exactly — an exact compare would be asserting mapUtils, not this room.
  const near = want.every(([x, y]) => R.coverBodies.some((c) => Math.abs(c.x - x) <= 40 && Math.abs(c.y - y) <= 40));
  ok('every cover object is on its frozen spot', near, JSON.stringify(R.coverBodies.map((c) => [c.x, c.y])));
}
ok('five props, on their frozen bodies', R.props.length === 5
  && R.props.some((p) => p.tex === 'prop-post' && p.x === 260 && p.y === 1230 && p.bw === 200 && p.bh === 110)
  && R.props.filter((p) => p.tex.startsWith('prop-bunk')).every((p) => p.bw === 120 && p.bh === 60),
  JSON.stringify(R.props));
ok('thirteen solid bodies total — eight cover, five props, nothing added',
  R.solids === 13, String(R.solids));

console.log('\n── NO FAKE SOLIDS ────────────────────────────────────────────');
ok('every cover body is the frozen 70x70', R.coverBodies.every((c) => c.bw === 70 && c.bh === 70),
  JSON.stringify(R.coverBodies.map((c) => [c.tex, c.bw, c.bh])));
ok('every cover sprite is bush-sized — the footprint cannot lie',
  R.coverBodies.every((c) => c.sw === R.bushSize[0] && c.sh === R.bushSize[1]),
  JSON.stringify([R.bushSize, R.coverBodies.map((c) => [c.tex, c.sw, c.sh])]));
ok('the two new cover textures are the kit size',
  [R.dtSizes.bench, R.dtSizes.benchB, R.dtSizes.lock].every((s) => s && s[0] === R.bushSize[0] && s[1] === R.bushSize[1]),
  JSON.stringify(R.dtSizes));

console.log('\n── THE AUTHORED ROOM ─────────────────────────────────────────');
ok('the architecture opt-in is present', R.arch.n >= 12, String(R.arch.n));
ok('it is large AND medium AND small, not one kind repeated',
  ['region', 'rib', 'plate', 'doorframe', 'inset', 'hatch', 'vent'].every((k) => R.arch.kinds.includes(k)),
  JSON.stringify(R.arch.kinds));
ok('the baked strip lights are OFF — six full-width cyan bars is what this replaced',
  R.arch.stripEvery === 0 && R.arch.accentEvery === 0, JSON.stringify([R.arch.stripEvery, R.arch.accentEvery]));
ok('no `ring` floor mark — a painted circle on the objective is a telegraph',
  !R.arch.markKinds.includes('ring'), JSON.stringify(R.arch.markKinds));
ok('contact shadows are on', R.arch.grounded);
ok('the perimeter is the `block` style at 96', R.perimeter.style === 'block' && R.perimeter.t === 96,
  JSON.stringify(R.perimeter));
ok('exactly one wall landmark, and it is the transfer gate',
  R.perimeter.features.length === 1 && R.perimeter.features[0] === 'transfergate',
  JSON.stringify(R.perimeter.features));

console.log('\n── THE EMERGENCY STATE ───────────────────────────────────────');
ok('the room declares light at all', R.srcs.length >= 10, String(R.srcs.length));
ok('at least one source is DEAD at normal power and lit on emergency',
  R.srcs.some((s) => (s.normal ?? 0) === 0 && (s.emergency ?? 0) > 0),
  JSON.stringify(R.srcs.filter((s) => (s.normal ?? 0) === 0).map((s) => s.kind)));
ok('no lamp gets LOUDER in the dark than a screen does — leds are nominal',
  R.srcs.filter((s) => s.kind === 'led').every((s) => s.emergency === s.normal),
  JSON.stringify(R.srcs.filter((s) => s.kind === 'led').map((s) => [s.normal, s.emergency])));
ok('no source is brighter at normal power than on emergency',
  R.srcs.every((s) => (s.emergency ?? 0) >= (s.normal ?? 0)));
{
  // NO RED IN THE ENVIRONMENT, and AMBER IS NOT RED: the separator is how far
  // green falls. Amber holds it near two thirds of red; danger red drops it
  // under a third. Both the base colour and the hot end are tested.
  const bad = [];
  for (const s of R.srcs) {
    for (const c of [s.color, s.hot]) {
      if (c == null) continue;
      const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
      if (r > 90 && g < r * 0.42 && b < r * 0.42) bad.push(c.toString(16));
    }
  }
  ok('no environment source is danger red', bad.length === 0, bad.join(','));
}
{
  // NO GREEN EITHER, and this rule is specific to this room: enemy bullets are
  // green, and a scatter of small green points along both walls during a
  // blackout is incoming fire that is not there.
  const bad = [];
  for (const s of R.srcs) {
    for (const c of [s.color, s.hot]) {
      if (c == null) continue;
      const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
      if (g > 90 && r < g * 0.6 && b < g * 0.6) bad.push(c.toString(16));
    }
  }
  ok('no environment source is bullet green', bad.length === 0, bad.join(','));
}
ok('THE CENTRE OF THE WALK RECEIVES NOTHING — x[700,900] y[560,840] is empty',
  R.inCore === 0, String(R.inCore));
ok('nothing on the walk is an EMITTER — the deck catches light, it does not make it',
  R.walkEmitters === 0, String(R.walkEmitters));
ok('THE CENTRE STATION IS NOT AN EMPTY FRAME — the camera\'s own view receives light',
  // Measured: 0.003 on the build the handset rejected, 0.084 on this one — a
  // 28x difference, so the gate sits an order of magnitude clear of both.
  R.inCentreView >= 0.04, String(R.inCentreView));
ok('THE FLOOR REFLECTIONS ARE FLAT — every one is at least 3.2:1, or it is a haze',
  R.refl >= 6 && R.reflFat === 0, JSON.stringify([R.refl, R.reflFat]));
ok('every floor reflection is emergency-only — a lit deck has nothing to reflect',
  R.reflLit === 0, String(R.reflLit));
ok('no two reflections share a footprint, and none can cross the room',
  R.reflSizes === R.refl && R.reflLongest < 420, JSON.stringify([R.reflSizes, R.refl, R.reflLongest]));
ok('every received-light source is a soft box with no hard bar in it',
  R.catches >= 12 && R.catchEmitters === 0, JSON.stringify([R.catches, R.catchEmitters]));
ok('three of eight cover objects are powered, five go out',
  R.kitPowered === 3, String(R.kitPowered));
ok('the five unpowered take the `prop` tint, not the console one',
  R.coverBodies.filter((c) => c.lo === 'prop').length === 5,
  JSON.stringify(R.coverBodies.map((c) => [c.tex, c.lo])));

console.log('\n── READABILITY: COMBAT IS ABOVE THE ENVIRONMENT ──────────────');
ok('every light part sits at or below the environment depth',
  R.minPartDepth >= 0 && R.envDepth === 3 && R.minPartDepth <= 4, JSON.stringify([R.envDepth, R.minPartDepth]));
ok('the player draws above every light', R.playerDepth > R.envDepth + 1, String(R.playerDepth));
ok('no light is inside roomLayer — a light the blackout can tint is not a light',
  R.inRoomLayer === 0, String(R.inRoomLayer));
// ── THE SOURCE IS BRIGHTER THAN THE EVIDENCE OF THE SOURCE.
//
// This check used to read `R.faces === 0`, on the argument that detention's
// dark identity is its architecture and no prop qualified for the exemption.
// Handset play found the hole the same way it found the junction's: a console
// PAINTS a lit display, so it CLAIMS to be an emitter, and every source the
// kit declares for it is built at depth 3 UNDERNEATH a 112px opaque sprite
// that sorts at `y + 56`. Only the ring of spill clearing the sprite's edge
// was ever on screen — a light installed behind the console, which is exactly
// what came back from the phone. The rule that admits a face is unchanged and
// it is the junction's second one: IF IT LOOKS LIKE AN EMITTER, IT MUST EMIT.
ok('the three powered consoles contain their own light',
  R.faces === 5 && R.faceDetail.every((f) => f.additive),
  JSON.stringify(R.faceDetail.map((f) => f.tex)));
ok('every face is registered on a console and contained by it',
  R.faceDetail.length > 0 && R.faceDetail.every((f) => f.hostTex && f.onHost),
  JSON.stringify(R.faceDetail.map((f) => [f.tex, f.hostTex, f.onHost])));
ok('THE UNPOWERED COVER STAYS DEAD — a face only lands on a console with a kit',
  R.coverFaces.filter((c) => c.faces > 0).length === 3
  && R.coverFaces.every((c) => c.powered || c.faces === 0),
  JSON.stringify(R.coverFaces.map((c) => [c.tex, c.powered, c.faces])));
ok('LIGHTS OUT is what the faces are for — restrained at normal, loud in the dark',
  R.faceDetail.every((f) => f.emergency > f.normal && f.normal <= 0.2)
  && R.faceDetail.filter((f) => f.normal === 0).length === 2,
  JSON.stringify(R.faceDetail.map((f) => [f.normal, f.emergency])));

console.log('\n── NO LEAKS ──────────────────────────────────────────────────');
ok('repeated loads do not duplicate lights',
  R.partSeq.every((n) => n === R.parts), JSON.stringify([R.partSeq, R.parts]));
ok('the power state restores exactly after a full cycle',
  JSON.stringify(R.power.before) === JSON.stringify(R.power.after)
  && JSON.stringify(R.power.before) !== JSON.stringify(R.power.dark));

console.log('\n── THE THREE APPROVED ARENAS ARE UNTOUCHED ───────────────────');
ok('NOT PROPAGATED — no other arena wears a detention console face',
  ['hangar', 'corridor', 'vader'].every((k) => !R.others[k].faceTex.some((t) => /^dt-face-/.test(t))),
  JSON.stringify(Object.fromEntries(Object.entries(R.others).map(([k, v]) => [k, v.faceTex]))));
ok('the Vader chamber still runs `chamber` and its light is unchanged',
  R.others.vader.style === 'chamber' && R.others.vader.parts === 66, JSON.stringify(R.others.vader));
ok('the hangar still runs `hangar`, with its two shuttle faces',
  R.others.hangar.style === 'hangar' && R.others.hangar.parts === 60 && R.others.hangar.faces === 2,
  JSON.stringify(R.others.hangar));
ok('the reactor junction still runs `junction`, with exactly one face',
  R.others.corridor.style === 'junction' && R.others.corridor.parts === 58 && R.others.corridor.faces === 1,
  JSON.stringify(R.others.corridor));

await browser.close();
console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) { fails.forEach((f) => console.log('  - ' + f)); process.exit(1); }
