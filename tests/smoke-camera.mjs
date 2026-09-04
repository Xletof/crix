// THE CAMERA'S STRUCTURAL TRUTHS — Phase 1.
//
// The camera is runtime-critical and almost entirely invisible to the rest of
// the suite: every other test either places the camera by hand or never looks
// at it, so the old tracker's south-wall failure survived four arena passes
// with a green suite behind it. What this protects:
//
//   1. FRAMING BOUNDS ARE NOT COLLISION BOUNDS. The camera's rect is the room
//      plus padding on all four sides; physics world bounds are still exactly
//      the room. If those two ever become the same number again the south edge
//      is broken, whatever else passes.
//   2. THE SOUTH SAFE AREA. Standing at the southern wall of each of the four
//      frozen arenas, the player's SCREEN y must clear the topmost touch
//      control. This is the acceptance case of the whole pass; on the build
//      this replaces it read 1253-1258 against a control edge at 926.
//   3. THE DEADZONE IS REAL. A player displaced by less than the deadzone must
//      move ZERO scroll. A camera that merely lerps more slowly passes any
//      "does it feel weighty" description and fails this.
//   4. THE DEADZONE IS NOT A PRISON. A displacement well beyond it must move
//      the camera. A check that only proves 3 passes on a camera that has
//      stopped working.
//   5. FIXED ZOOM. Phase 1 is fixed zoom by instruction, and zoom silently
//      changes the world size of both the deadzone and the safe area.
//   6. NO INVALID SCROLL, EVER, and the camera stays inside its own framing
//      rect — including at the corners, where two clamps meet.
//   7. ROOM TRANSITIONS RESET IT. Repeated loads must arrive composed, with
//      the spring at rest, and must not drift a pixel across repeats: the
//      target, the spring velocity and the lookahead smoother are all STATE.
//   8. NOTHING ELSE DRIVES THE CAMERA. `startFollow` is gone; a follow target
//      reinstated anywhere would fight the director for the same scroll.
//
// A/B NOTE: 1, 2, 5 and 8 all fail on the pre-Phase-1 build, which is the only
// reason they are worth running. 3 and 4 are a matched pair for the same
// reason — 3 alone passes on a broken camera that never moves.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const URL = 'http://localhost:5173/?nodlg=1&nofreeze=1';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const fails = [];
const errors = [];

const browser = await chromium.launch({ executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(URL);
await page.waitForTimeout(4500);
await page.mouse.click(360, 640);
await page.waitForTimeout(800);
await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 31 }));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(1500);

// The bot must not die mid-measurement, and a live camera punch is a live zoom
// write — a station that photographs one reports a resting zoom of 1.10.
const quiet = () => page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs.lives = 9999; gs.player.hp = gs.player.hpMax = 1e9;
  for (const e of gs.enemies.getChildren().slice()) e.destroy();
  if (gs._cameraPunchTween) { gs._cameraPunchTween.stop(); gs._cameraPunchTween = null; }
  gs.cameras.main.setZoom(1);
});

const cfg = await page.evaluate(async () => {
  const { CAMERA, PLAYER, VIEW, HUDCFG } = await import('/src/config.js');
  const { getControls } = await import('/src/systems/controlLayout.js');
  return {
    // Guarded: with `CAMERA` gone this would throw inside page.evaluate and the
    // whole file would read as a harness crash rather than as the camera
    // config having been deleted.
    cam: CAMERA ? JSON.parse(JSON.stringify(CAMERA)) : null,
    radius: PLAYER.radius,
    view: { ...VIEW }, topBar: HUDCFG.topBarHeight,
    ctrlTop: Math.min(...getControls().map((c) => c.y - c.radius)),
  };
});

if (!cfg.cam) {
  console.error('\nFAIL:\n  - src/config.js exports no CAMERA block — the camera director has nothing to read');
  await browser.close();
  process.exit(1);
}

// 5 — fixed zoom. Read from config, not from a frame: a `_cameraPunch` is
// allowed to move zoom transiently and always returns to 1.
if (cfg.cam.zoomBreathe !== 0) fails.push(`CAMERA.zoomBreathe is ${cfg.cam.zoomBreathe} — fixed zoom, through Phase 2A`);
if (cfg.cam.leadAim !== 0) fails.push(`CAMERA.leadAim is ${cfg.cam.leadAim} — aim influence is PHASE 2B and must not ship with 2A`);
if (cfg.cam.debug) fails.push('CAMERA.debug shipped ON — the overlay is debug-only');

// ── PHASE 2A: RESPONSIVE X, COMPOSED Y ─────────────────────────────────────
// Three structural claims, not tuning. The handset approved Phase 1's vertical
// feel and rejected its lateral one, so the answer had to be a better X
// composition rather than a faster camera — and each of these is what stops
// the next pass quietly turning it back into the latter.
if (!(cfg.cam.stiffnessX > cfg.cam.stiffnessY))
  fails.push(`stiffnessX ${cfg.cam.stiffnessX} is not above stiffnessY ${cfg.cam.stiffnessY} — X is meant to be the eager axis`);
if (cfg.cam.stiffnessY !== 13.5)
  fails.push(`stiffnessY moved to ${cfg.cam.stiffnessY} — the vertical spring is the approved Phase 1 feel and this pass may not touch it`);
if (!(cfg.cam.dzX < cfg.cam.dzDown))
  fails.push(`dzX ${cfg.cam.dzX} is not tighter than dzDown ${cfg.cam.dzDown} — portrait width is the scarce axis`);
// VERTICAL LEAD IS ZERO BY CONSTRUCTION, and that is what keeps the south
// guarantee below from resting on a margin. A northward lead pushes the player
// DOWN the screen; at the south wall the framing clamp is the only thing
// holding them clear of the controls, and 45px of it would land them at 931
// against a control edge at 926.
if (cfg.cam.leadY !== 0)
  fails.push(`CAMERA.leadY is ${cfg.cam.leadY} — a vertical lead trades the Phase 1 south win for anticipation nobody asked for`);
if (!(cfg.cam.leadX >= 60 && cfg.cam.leadX <= 260))
  fails.push(`CAMERA.leadX is ${cfg.cam.leadX} — outside the range where a lead helps without becoming a trick`);
// The filter has to have BOTH constants and neither may be cinematic.
if (!(cfg.cam.leadAttackMs > 0 && cfg.cam.leadAttackMs <= 260))
  fails.push(`leadAttackMs ${cfg.cam.leadAttackMs} — a lead that opens slower than a quarter second is not anticipation`);
if (!(cfg.cam.leadReleaseMs >= cfg.cam.leadAttackMs && cfg.cam.leadReleaseMs <= 700))
  fails.push(`leadReleaseMs ${cfg.cam.leadReleaseMs} — release must be the slower of the two and must not hang around`);

// 3, first half — THE DEADZONE HAS TO BE BIG ENOUGH TO BE ONE.
// Phase 2A halved dzX; this floor is what stops the next tightening pass from
// deleting it outright and calling the result "snappier". The drift check
// below displaces the player by a FRACTION of the configured extents, so with
// the extents at zero it displaces by zero and passes on a camera with no
// deadzone at all: a check that passes on the bug. This is the floor that
// stops that. It pins the CONCEPT, not the tuning — 40px is a fifth of the
// smallest reasonable value and the human's numbers sit far above it.
for (const k of ['dzX', 'dzUp', 'dzDown']) {
  if (!(cfg.cam[k] >= 40)) fails.push(`CAMERA.${k} is ${cfg.cam[k]} — below 40px there is no deadzone, only a lerp`);
}

// ── Per-room walk of the four frozen arenas ────────────────────────────────
const ROOMS = ['vader', 'hangar', 'corridor', 'detention'];

for (const id of ROOMS) {
  await page.evaluate(async (rid) => {
    const gs = window.game.scene.getScene('Game');
    const { ROOMS } = await import('/src/data/rooms.js');
    gs.loadRoom(ROOMS.find((r) => r.id === rid));
  }, id);
  await page.waitForTimeout(1200);
  await quiet();

  const b = await page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    const c = gs.cameras.main, w = gs.physics.world.bounds;
    return {
      room: { w: gs.roomSpec.bounds.w, h: gs.roomSpec.bounds.h },
      phys: { x: w.x, y: w.y, w: w.width, h: w.height },
      frame: { x: c._bounds.x, y: c._bounds.y, w: c._bounds.width, h: c._bounds.height },
      zoom: c.zoom,
      follow: !!c._follow,
      viewW: c.width, viewH: c.height, viewY: c.y,
      spec: !!gs.roomSpec.camera,
    };
  });

  // 1 — the two rects must differ, in the direction the config says.
  if (b.phys.x !== 0 || b.phys.y !== 0 || b.phys.w !== b.room.w || b.phys.h !== b.room.h)
    fails.push(`${id}: physics world bounds are no longer the room (${JSON.stringify(b.phys)}) — Phase 1 may not touch collision`);
  const padS = Math.min(Math.max(b.viewH - cfg.radius - ((cfg.ctrlTop - cfg.topBar) - cfg.cam.southClearance), cfg.cam.padSouthMin), cfg.cam.padSouthMax);
  const want = { x: -cfg.cam.padSide, y: -cfg.cam.padNorth, w: b.room.w + cfg.cam.padSide * 2, h: b.room.h + cfg.cam.padNorth + padS };
  if (b.spec) {
    // A room may override its padding as DATA. None of the four does today; if
    // one starts to, this check has to stop asserting the global numbers at it
    // rather than be deleted.
    fails.push(`${id}: carries a spec.camera override — this check asserts the global padding and must be taught about it`);
  } else {
    for (const k of ['x', 'y', 'w', 'h']) {
      if (Math.abs(b.frame[k] - want[k]) > 1)
        fails.push(`${id}: camera framing ${k} is ${b.frame[k]}, expected ${want[k]} (room ${b.room.w}x${b.room.h} + padding)`);
    }
  }
  if (b.frame.w === b.room.w && b.frame.h === b.room.h)
    fails.push(`${id}: camera bounds equal room bounds — framing freedom is gone and the south edge is broken`);

  // 8 — nothing else drives the camera.
  if (b.follow) fails.push(`${id}: the camera has a follow target again — two systems writing one scroll`);
  // 5 again, live.
  if (Math.abs(b.zoom - 1) > 1e-6) fails.push(`${id}: resting zoom is ${b.zoom}, not 1`);

  // ── 2, 6 — the four edges and the four corners ───────────────────────────
  // Teleport rather than walk: this is a CLAMP test, and the clamp is a pure
  // function of where the player is. `reset()` composes without travel, which
  // is exactly the resting frame the acceptance case asks about.
  const stations = [
    ['N', 0.5, 0], ['S', 0.5, 1], ['W', 0, 0.5], ['E', 1, 0.5],
    ['NW', 0, 0], ['NE', 1, 0], ['SW', 0, 1], ['SE', 1, 1],
  ];
  for (const [name, fx, fy] of stations) {
    const r = await page.evaluate(([ffx, ffy, rad]) => {
      const gs = window.game.scene.getScene('Game');
      const { w, h } = gs.roomSpec.bounds;
      const px = rad + ffx * (w - rad * 2), py = rad + ffy * (h - rad * 2);
      gs.player.setPosition(px, py); gs.player.setVelocity(0, 0);
      gs.cameraDirector.reset(px, py);
      const c = gs.cameras.main;
      return {
        px, py, sx: c.scrollX, sy: c.scrollY,
        screenX: (px - c.scrollX) * c.zoom + c.x,
        screenY: (py - c.scrollY) * c.zoom + c.y,
        fx0: c._bounds.x, fy0: c._bounds.y, fw: c._bounds.width, fh: c._bounds.height,
        vw: c.width / c.zoom, vh: c.height / c.zoom,
      };
    }, [fx, fy, cfg.radius]);

    if (!Number.isFinite(r.sx) || !Number.isFinite(r.sy))
      fails.push(`${id} ${name}: scroll is not a number (${r.sx}, ${r.sy})`);
    if (r.sx < r.fx0 - 1 || r.sx > r.fx0 + r.fw - r.vw + 1
      || r.sy < r.fy0 - 1 || r.sy > r.fy0 + r.fh - r.vh + 1)
      fails.push(`${id} ${name}: scroll (${Math.round(r.sx)},${Math.round(r.sy)}) is outside its own framing rect`);

    // 2 — THE ACCEPTANCE CASE. Every southern station must clear the controls.
    if (fy === 1 && r.screenY >= cfg.ctrlTop)
      fails.push(`${id} ${name}: player at the south wall sits at screen y ${Math.round(r.screenY)}, at or below the topmost control edge (${cfg.ctrlTop})`);
    // And no station may put the player against a screen edge.
    if (r.screenX < 40 || r.screenX > cfg.view.width - 40)
      fails.push(`${id} ${name}: player at screen x ${Math.round(r.screenX)} — pinned to the frame edge`);
    if (r.screenY < cfg.topBar + 40)
      fails.push(`${id} ${name}: player at screen y ${Math.round(r.screenY)} — jammed under the HUD bar`);
  }
}

// ── 3 + 4 — the deadzone, as a matched pair ────────────────────────────────
// Run in the detention block, at its centre, where no clamp is anywhere near.
const dz = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { ROOMS } = await import('/src/data/rooms.js');
  gs.loadRoom(ROOMS.find((r) => r.id === 'detention'));
  return null;
});
await page.waitForTimeout(1200);
await quiet();

const dzr = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { CAMERA } = await import('/src/config.js');
  const c = gs.cameras.main, d = gs.cameraDirector;
  const at = (x, y) => { gs.player.setPosition(x, y); gs.player.setVelocity(0, 0); };
  const step = () => d.update(16);
  const out = {};

  // Settle at the centre.
  at(800, 700); d.reset(800, 700);
  for (let i = 0; i < 90; i++) step();
  const s0 = { x: c.scrollX, y: c.scrollY };

  // INSIDE the deadzone — 80% of each half-extent, in every direction. The
  // scroll must not move at all.
  let inside = 0;
  for (const [dx, dy] of [[0.8, 0], [-0.8, 0], [0, -0.8], [0, 0.8]]) {
    at(800 + dx * CAMERA.dzX, 700 + dy * (dy > 0 ? CAMERA.dzDown : CAMERA.dzUp));
    for (let i = 0; i < 60; i++) step();
    inside = Math.max(inside, Math.hypot(c.scrollX - s0.x, c.scrollY - s0.y));
  }
  out.insideDrift = inside;

  // OUTSIDE it — 400px, well past any half-extent. The camera must follow.
  at(800, 700); d.reset(800, 700);
  for (let i = 0; i < 60; i++) step();
  const s1 = { x: c.scrollX, y: c.scrollY };
  at(1200, 1100);
  for (let i = 0; i < 200; i++) step();
  out.outsideMove = Math.hypot(c.scrollX - s1.x, c.scrollY - s1.y);

  // 7 — the same room loaded twice must compose identically, with the spring
  // at rest. State that survives a room boundary is state that drifts.
  const seen = [];
  for (const id of ['hangar', 'detention', 'hangar', 'detention']) {
    const spec = (await import('/src/data/rooms.js')).ROOMS.find((r) => r.id === id);
    gs.loadRoom(spec);
    seen.push({ id, sx: c.scrollX, sy: c.scrollY, vx: d._vx, vy: d._vy, lo: d._leadX });
  }
  out.loads = seen;
  return out;
});

if (dzr.insideDrift > 0.5)
  fails.push(`deadzone: a displacement inside it moved the camera ${dzr.insideDrift.toFixed(1)}px — the player cannot move within the frame`);
if (dzr.outsideMove < 200)
  fails.push(`deadzone: a 400px displacement moved the camera only ${dzr.outsideMove.toFixed(1)}px — the deadzone is a prison, not a deadzone`);
for (const l of dzr.loads) {
  if (!Number.isFinite(l.sx) || !Number.isFinite(l.sy)) fails.push(`room load ${l.id}: scroll is not a number`);
  if (Math.abs(l.vx) > 1e-6 || Math.abs(l.vy) > 1e-6) fails.push(`room load ${l.id}: the spring arrived moving (${l.vx}, ${l.vy}) — the camera flies in from the previous room`);
  if (Math.abs(l.lo) > 1e-6) fails.push(`room load ${l.id}: the movement lead carried across a room boundary`);
}
const h = dzr.loads.filter((l) => l.id === 'hangar');
const d2 = dzr.loads.filter((l) => l.id === 'detention');
for (const [a, b2] of [h, d2]) {
  if (Math.abs(a.sx - b2.sx) > 0.5 || Math.abs(a.sy - b2.sy) > 0.5)
    fails.push(`${a.id}: two loads composed differently (${a.sx},${a.sy}) vs (${b2.sx},${b2.sy}) — camera state leaks across rooms`);
}

// ── PHASE 2A behavioural checks ────────────────────────────────────────────
//
// Two of them, and they are a matched pair for the same reason the deadzone
// checks are: "the lead opens" passes on a lead that never closes, and "the
// lead closes" passes on a lead that never opened.
//
// Driven by writing `_moveTargetX` — the same field the joystick writes and the
// same one the solver reads — and stepping the director directly, because a
// real stick at ~20fps cannot hold a measured direction for a fixed number of
// frames.
const lead = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { CAMERA, PLAYER } = await import('/src/config.js');
  const { ROOMS } = await import('/src/data/rooms.js');
  gs.loadRoom(ROOMS.find((r) => r.id === 'detention'));
  const c = gs.cameras.main, d = gs.cameraDirector, p = gs.player;
  const at = (x, y) => { p.setPosition(x, y); p.setVelocity(0, 0); };
  const push = (sx) => { p._moveTargetX = sx * PLAYER.speed; p._moveTargetY = 0; };
  const step = (n) => { for (let i = 0; i < n; i++) d.update(16); };
  const screenX = () => (p.x - c.scrollX) * c.zoom + c.x;
  const out = {};

  // Neutral composition at the room's middle, no input.
  at(800, 700); push(0); d.reset(800, 700); step(60);
  out.neutralX = screenX();

  // SUSTAINED EAST. The player is held still so the ONLY thing that can move
  // the camera is the lead — otherwise this measures walking, not anticipation.
  push(1); step(90);
  out.eastX = screenX();
  out.eastLead = d._leadX;

  // SUSTAINED WEST, from a hard reversal. Time it: the lead has to cross
  // neutral and reach the far side, and "responsive without snapping" means
  // this is bounded but not instant.
  push(-1);
  let frames = 0;
  while (frames < 200 && d._leadX > -CAMERA.leadX * 0.8) { d.update(16); frames++; }
  out.reversalFrames = frames;
  step(60);
  out.westX = screenX();
  out.westLead = d._leadX;

  // STOP. The lead must return to ~zero on its own.
  push(0); step(120);
  out.restLead = d._leadX;
  out.restX = screenX();
  return out;
});

// The east/west shift must be real, symmetric, and not a shove to the edge.
const shiftE = lead.neutralX - lead.eastX;
const shiftW = lead.westX - lead.neutralX;
if (shiftE < 60) fails.push(`sustained east moved the player only ${shiftE.toFixed(0)}px left of neutral — no useful world opened ahead`);
if (shiftW < 60) fails.push(`sustained west moved the player only ${shiftW.toFixed(0)}px right of neutral`);
if (Math.abs(shiftE - shiftW) > 12) fails.push(`the lead is asymmetric: east ${shiftE.toFixed(0)}px vs west ${shiftW.toFixed(0)}px`);
// ...and it must stay well inside the frame. A player shoved toward the far
// edge is the camera doing a trick, which is the failure on the other side.
if (lead.eastX < 120 || lead.westX > cfg.view.width - 120)
  fails.push(`the lead pushes the player to screen x ${lead.eastX.toFixed(0)}/${lead.westX.toFixed(0)} — too close to the opposite edge`);
// A reversal at ~16ms/step: fast enough to be an action game, slow enough to
// have mass. Instant would mean the filter is gone.
if (lead.reversalFrames < 6) fails.push(`a hard reversal crossed the lead in ${lead.reversalFrames} steps — the lead is teleporting, not filtered`);
if (lead.reversalFrames > 60) fails.push(`a hard reversal took ${lead.reversalFrames} steps (~${(lead.reversalFrames * 16 / 1000).toFixed(2)}s) — cinematic drift, not anticipation`);
// And it decays.
if (Math.abs(lead.restLead) > 2) fails.push(`the lead did not return to zero after input stopped (${lead.restLead.toFixed(1)}px)`);
// NEAR neutral, not ON it, and the residual is the DEADZONE — which is the
// point of having one. When the lead closes, the ideal scroll moves back by the
// full lead but the target only has to be within dzX of it, so the player ends
// up to dzX off centre and the camera does not spend a pull to fix it. Measured
// at exactly 60px against a 130px lead. Asserting a return to centre here would
// be asserting a camera that re-centres on its own, which is the opposite of
// what was approved.
const rest = Math.abs(lead.restX - lead.neutralX);
if (rest > cfg.cam.dzX + 8)
  fails.push(`after stopping the player sits ${rest.toFixed(0)}px off neutral, beyond the deadzone (${cfg.cam.dzX}) — the composition did not come back`);
if (rest > shiftE)
  fails.push(`after stopping the player is further from neutral (${rest.toFixed(0)}px) than the lead ever moved them (${shiftE.toFixed(0)}px) — the lead is not releasing`);

// ── §15 — THE PHASE 1 SOUTH WIN, UNDER MAXIMUM LATERAL LEAD ───────────────
//
// The main Phase 1 result was that a player at the southern wall stays clear of
// the touch controls. Phase 2A may not trade that for horizontal visibility, so
// this re-runs the acceptance case in every arena with the lead pinned hard
// east and hard west — the two states a lateral traversal along the south wall
// actually passes through.
for (const id of ROOMS) {
  const rows = await page.evaluate(async ([rid, rad]) => {
    const gs = window.game.scene.getScene('Game');
    const { ROOMS } = await import('/src/data/rooms.js');
    const { PLAYER } = await import('/src/config.js');
    gs.loadRoom(ROOMS.find((r) => r.id === rid));
    const c = gs.cameras.main, d = gs.cameraDirector, p = gs.player;
    const { w, h } = gs.roomSpec.bounds;
    const out = [];
    for (const [name, fx, dir] of [['S-w', 0.5, -1], ['S-e', 0.5, 1], ['SW', 0, -1], ['SE', 1, 1], ['SW-e', 0, 1], ['SE-w', 1, -1]]) {
      const px = rad + fx * (w - rad * 2), py = h - rad;
      p.setPosition(px, py); p.setVelocity(0, 0);
      p._moveTargetX = dir * PLAYER.speed; p._moveTargetY = 0;
      d.reset(px, py);
      for (let i = 0; i < 140; i++) { p.setPosition(px, py); d.update(16); }
      out.push({
        name,
        screenX: (px - c.scrollX) * c.zoom + c.x,
        screenY: (py - c.scrollY) * c.zoom + c.y,
        lead: d._leadX,
      });
    }
    p._moveTargetX = 0; p._moveTargetY = 0;
    return out;
  }, [id, cfg.radius]);
  for (const r of rows) {
    if (r.screenY >= cfg.ctrlTop)
      fails.push(`${id} ${r.name}: at the south wall with a ${r.lead.toFixed(0)}px lateral lead the player is at screen y ${r.screenY.toFixed(0)}, at or below the control edge (${cfg.ctrlTop}) — Phase 2A broke the Phase 1 win`);
    if (r.screenX < 40 || r.screenX > cfg.view.width - 40)
      fails.push(`${id} ${r.name}: lead pushed the player to screen x ${r.screenX.toFixed(0)} — pinned to the frame edge`);
  }
}

if (errors.length) fails.push(`page errors: ${errors.join(' | ')}`);

await browser.close();
if (fails.length) {
  console.error('\nFAIL:'); for (const f of fails) console.error('  -', f);
  process.exit(1);
}
console.log('\nsmoke-camera OK');
