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
// ── PHASE 2C config claims ─────────────────────────────────────────────────
// Ordinary fire sits BETWEEN locomotion and explicit commitment, and each of
// these is what stops it drifting to one end or the other.
if (!(cfg.cam.aimLeadX < cfg.cam.abilityLeadX))
  fails.push(`aimLeadX ${cfg.cam.aimLeadX} is not below abilityLeadX ${cfg.cam.abilityLeadX} — ordinary fire must be more restrained than an explicit preview`);
if (!(cfg.cam.aimLeadY < cfg.cam.aimLeadX))
  fails.push(`aimLeadY ${cfg.cam.aimLeadY} — vertical combat lead must stay restrained relative to horizontal`);
// THE DELIBERATE DIFFERENCE FROM ABILITY INTENT. Explicit commitment may own
// the frame outright (`abilityMoveKeep` 0); ordinary shooting may not, because
// the player is usually dodging while they do it.
if (!(cfg.cam.aimMoveKeep > 0.1 && cfg.cam.aimMoveKeep < 0.5))
  fails.push(`aimMoveKeep ${cfg.cam.aimMoveKeep} — movement must survive ordinary fire as a real minority, not vanish and not tie`);
if (!(cfg.cam.aimMoveKeep > cfg.cam.abilityMoveKeep))
  fails.push('aimMoveKeep must exceed abilityMoveKeep — ordinary fire blends with movement, an ability replaces it');
if (!(cfg.cam.leadCombinedMax <= cfg.cam.abilityLeadX))
  fails.push(`leadCombinedMax ${cfg.cam.leadCombinedMax} exceeds abilityLeadX — implicit signals must never out-frame an explicit one`);
if (!(cfg.cam.aimMemoryMs >= 300 && cfg.cam.aimMemoryMs <= 1500))
  fails.push(`aimMemoryMs ${cfg.cam.aimMemoryMs} — outside the range where several taps are one intention but a stale sector still expires`);
if (!(cfg.cam.aimShotsForFull >= 2))
  fails.push(`aimShotsForFull ${cfg.cam.aimShotsForFull} — below 2 a single shot carries most of the lead, and one shot is noise`);

// ── PHASE 3A config claims ─────────────────────────────────────────────────
// VADER IS AN INTEREST SIGNAL, NOT THE OWNER OF THE CAMERA, and these are the
// numeric form of that sentence. Every one is relational: the external signal
// is the smallest voice in the composition and the calmest filter in it.
if (!(cfg.cam.bossLeadMax <= cfg.cam.leadX))
  fails.push(`bossLeadMax ${cfg.cam.bossLeadMax} is not below the movement lead ${cfg.cam.leadX} — an external actor may not out-frame the player's own locomotion`);
if (!(cfg.cam.bossLeadMax < cfg.cam.abilityLeadX))
  fails.push(`bossLeadMax ${cfg.cam.bossLeadMax} reaches an explicit ability's authority (${cfg.cam.abilityLeadX})`);
if (!(cfg.cam.bossLeadMax <= cfg.cam.aimLeadX))
  fails.push(`bossLeadMax ${cfg.cam.bossLeadMax} exceeds ordinary combat intent (${cfg.cam.aimLeadX}) — the room may not out-shout the player's own fight`);
if (!(cfg.cam.bossLeadY <= cfg.cam.bossLeadX))
  fails.push(`bossLeadY ${cfg.cam.bossLeadY} — vertical is the axis the controls own, and it must stay the restrained one`);
// THE CALMEST FILTER, and deliberately slower than either player intent: an
// explicit preview is acknowledged fastest because the player just asked for
// it, and an external actor's wandering slowest because nobody asked at all.
if (!(cfg.cam.bossAttackMs > cfg.cam.leadAttackMs && cfg.cam.bossAttackMs > cfg.cam.abilityAttackMs))
  fails.push(`bossAttackMs ${cfg.cam.bossAttackMs} is not the slowest acquisition in the composition — Vader's footwork will tick the frame`);
if (!(cfg.cam.bossReleaseMs > cfg.cam.bossAttackMs))
  fails.push('bossReleaseMs must be the slower of the pair — losing Vader should be a fade, not a snap back to the player');
if (!(cfg.cam.bossAbilityKeep >= 0 && cfg.cam.bossAbilityKeep < 0.5))
  fails.push(`bossAbilityKeep ${cfg.cam.bossAbilityKeep} — at or above 0.5 an explicit Super or melee no longer outranks the boss`);
// A RAMP, NOT A MODE SWITCH. A margin or ramp of zero is a visible/offscreen
// boolean, which pops every time he crosses it — and in a real fight he
// crosses it constantly.
if (!(cfg.cam.bossNeedRamp >= 80))
  fails.push(`bossNeedRamp ${cfg.cam.bossNeedRamp} — below ~80px this is a threshold, not a ramp, and it will pop`);
for (const k of ['bossMarginX', 'bossMarginY']) {
  if (!(cfg.cam[k] >= 40))
    fails.push(`CAMERA.${k} is ${cfg.cam[k]} — with no comfort inset a Vader anywhere but dead centre asks for frame`);
}
if (!(cfg.cam.bossFarEnd > cfg.cam.bossFarStart))
  fails.push('bossFarEnd must exceed bossFarStart — the distance fade needs a span to fade across');

// ── PHASE 2B config claims ─────────────────────────────────────────────────
// Explicit ability intent is meant to be BETTER information than locomotion, so
// it may lead harder; and it is allowed vertical authority the movement lead is
// not, because `_clampSafeArea` now guards the final target instead of trusting
// each input. Neither of those is licence for an unbounded number.
if (!(cfg.cam.abilityLeadX > cfg.cam.leadX))
  fails.push(`abilityLeadX ${cfg.cam.abilityLeadX} does not outweigh the movement lead ${cfg.cam.leadX} — explicit commitment is meant to win the frame`);
if (!(cfg.cam.abilityLeadY > 0 && cfg.cam.abilityLeadY < cfg.cam.abilityLeadX))
  fails.push(`abilityLeadY ${cfg.cam.abilityLeadY} — vertical ability lead must exist and stay restrained relative to horizontal`);
if (!(cfg.cam.abilityAttackMs < cfg.cam.leadAttackMs))
  fails.push(`abilityAttackMs ${cfg.cam.abilityAttackMs} is not faster than the movement lead's ${cfg.cam.leadAttackMs} — an explicit preview should be acknowledged sooner`);
if (!(cfg.cam.abilityAttackMs >= 40))
  fails.push(`abilityAttackMs ${cfg.cam.abilityAttackMs} — below ~40ms this stops being a filter and becomes the aim stick dragging the camera`);
if (!(cfg.cam.abilityReleaseMs > cfg.cam.abilityAttackMs))
  fails.push('abilityReleaseMs must be the slower of the pair — an ability lead should let go more gently than it acquires');
if (!(cfg.cam.abilityMoveKeep >= 0 && cfg.cam.abilityMoveKeep < 0.5))
  fails.push(`abilityMoveKeep ${cfg.cam.abilityMoveKeep} — at or above 0.5 movement is no longer secondary and the priority rule is gone`);
if (!(cfg.cam.abilityMeleeMaxMs > cfg.cam.abilityMeleeHoldMs))
  fails.push('abilityMeleeMaxMs must exceed the melee hold — it is the ceiling on the re-arm, not a shorter hold');
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

// ── PHASE 2B — ABILITY INTENT ─────────────────────────────────────────────
//
// Four structural claims, driven through the REAL entry points the touch
// widgets call. Poking `superAim` directly would test a field rather than a
// feature, and would miss that both release paths clear their own preview flag
// before the cast — which is the entire reason `commitAbility` exists.
const ab = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { ROOMS } = await import('/src/data/rooms.js');
  // The GAME's own CAMERA object, reached through the director rather than a
  // fresh dynamic import — an `import('/src/config.js')` inside page.evaluate
  // hands back a SECOND copy, and mutating that one changes nothing the running
  // camera reads. See tests/README.
  const { PLAYER } = await import('/src/config.js');
  gs.loadRoom(ROOMS.find((r) => r.id === 'detention'));
  const c = gs.cameras.main, d = gs.cameraDirector, p = gs.player;
  const CAMERA2 = d.cfg;
  const step = (n) => {
    for (let i = 0; i < n; i++) {
      // The player's own clocks have to tick: the camera reads `_meleeAnimT`,
      // and a rig that freezes it measures a state that cannot occur.
      if (p._meleeAnimT > 0) p._meleeAnimT = Math.max(0, p._meleeAnimT - 16);
      if (p._comboWindowMs > 0) p._comboWindowMs = Math.max(0, p._comboWindowMs - 16);
      d.update(16);
    }
  };
  const stage = () => {
    p.setPosition(800, 700); p.setVelocity(0, 0);
    p._moveTargetX = 0; p._moveTargetY = 0;
    p.superAiming = false; p.meleeAiming = false;
    p.resetMeleeCombo(); p._suppressedMs = 0; p.isDashing = false;
    p.superCharge = 99; p.meleeCharge = 99;
    d.reset(800, 700); step(50);
  };
  const sx = () => (p.x - c.scrollX) * c.zoom + c.x;
  const E = { x: 1, y: 0, force: 1 };
  const out = {};

  // 1 — NO ABILITY, NO INFLUENCE. Idle with nothing armed must leave the
  // ability input at exactly zero, or Phase 2A is being quietly modified.
  stage();
  out.idleW = d._abW;
  out.idleX = sx();

  // 2 — A PREVIEW OPENS THE AIMED DIRECTION, and beats an opposing movement
  // lead rather than averaging with it into a neutral frame.
  stage();
  p._moveTargetX = -PLAYER.speed;          // travelling WEST
  step(80);
  out.moveOnlyX = sx();
  p.setSuperAimInput(E);                   // aiming EAST
  step(70);
  out.conflictX = sx();
  out.conflictW = d._abW;

  // 3 — EXECUTION RETAINS THE COMMITTED DIRECTION. Both release paths drop the
  // preview flag before the cast; the frame must not go with it.
  stage();
  p.setMeleeAimInput(E); p.meleeAiming = true;
  step(60);
  out.meleePreviewX = sx();
  const fired = p.releaseMeleeAim(E);
  out.meleeFired = fired;
  out.meleeArmedAfter = p.meleeAiming;
  out.meleeCommitMs = d._abCommitMs;
  step(8);
  out.meleeJustAfterX = sx();
  out.meleeJustAfterW = d._abW;
  step(200);
  out.meleeSettledW = d._abW;
  out.meleeSettledX = sx();

  // 4 — A CANCELLED PREVIEW RETAINS NOTHING. Dropping the aim without firing
  // (death, a suppressed release) must leave no committed hold behind.
  stage();
  p.setSuperAimInput(E);
  step(60);
  out.cancelArmedW = d._abW;
  p.superAiming = false;                    // cancelled, never cast
  out.cancelCommitMs = d._abCommitMs;
  step(200);
  out.cancelSettledW = d._abW;
  out.cancelSettledX = sx();

  // 5 — THE SAFE-AREA GUARD, MEASURED WHERE IT ACTUALLY DECIDES ANYTHING.
  // At a southern WALL the framing clamp already pins the player, so a check
  // there passes with the guard deleted — it proves nothing. In OPEN FLOOR
  // nothing else is holding the line: an ability aiming north pushes the player
  // down the screen by the full lead, and `_clampSafeArea` is the only thing
  // that can refuse it. Measured at the configured lead and again at a
  // deliberately absurd one, because a guard that cannot be shown to engage is
  // decoration.
  // Staged in the SOUTHERN half of the open floor, not mid-room: at (800, 700)
  // detention's northern framing edge is only ~800px away, so the framing clamp
  // catches an extreme north lead first and the check passes with the guard
  // deleted. It has to be somewhere neither the framing rect nor a wall is
  // already deciding.
  p.setPosition(800, 1050); p.setVelocity(0, 0);
  p._moveTargetX = 0; p._moveTargetY = 0;
  p.superAiming = false; p.meleeAiming = false;
  p.superCharge = 99;
  d.reset(800, 1050); step(50);
  p.setSuperAimInput({ x: 0, y: -1, force: 1 });
  step(90);
  out.aimNorthY = (p.y - c.scrollY) * c.zoom + c.y;
  const savedY = CAMERA2.abilityLeadY;
  CAMERA2.abilityLeadY = 900;               // far past anything shippable
  step(120);
  out.aimNorthExtremeY = (p.y - c.scrollY) * c.zoom + c.y;
  CAMERA2.abilityLeadY = savedY;

  p.superAiming = false; p.meleeAiming = false; p.resetMeleeCombo();
  return out;
});

if (ab.idleW !== 0)
  fails.push(`ability weight is ${ab.idleW} with nothing armed — ability intent must be inert unless an ability asks for it`);
if (!ab.meleeFired)
  fails.push('the melee cast was REFUSED, so the execution checks below prove nothing about a commit');
if (ab.meleeArmedAfter)
  fails.push('meleeAiming survived the cast — the test is not exercising the preview-vanishes case it exists for');
// 2: the aimed direction must gain real ground against an opposing movement lead.
const conflictGain = ab.moveOnlyX - ab.conflictX;
if (conflictGain < 120)
  fails.push(`aiming east while travelling west moved the player only ${conflictGain.toFixed(0)}px — ability intent is being averaged with movement, not winning`);
if (!(ab.conflictW > 0.9))
  fails.push(`ability weight only reached ${ab.conflictW.toFixed(2)} while a preview was armed`);
// 3: the frame holds through the cast, then returns.
if (!(ab.meleeCommitMs > 0))
  fails.push('no committed hold was retained at the melee cast — the camera will forget the direction as the body starts moving along it');
if (Math.abs(ab.meleeJustAfterX - ab.meleePreviewX) > 40)
  fails.push(`the frame jumped ${Math.abs(ab.meleeJustAfterX - ab.meleePreviewX).toFixed(0)}px at the cast — composition is not continuous through the commit`);
if (!(ab.meleeJustAfterW > 0.9))
  fails.push(`ability weight collapsed to ${ab.meleeJustAfterW.toFixed(2)} at the cast`);
if (ab.meleeSettledW > 0.02)
  fails.push(`the ability lead never released after the melee (weight ${ab.meleeSettledW.toFixed(2)}) — a stuck commit holds the frame for ever`);
// 4: a cancel retains nothing at all.
if (ab.cancelCommitMs !== 0)
  fails.push(`a cancelled preview left ${ab.cancelCommitMs}ms of committed hold — only a real cast may commit`);
if (ab.cancelSettledW > 0.02)
  fails.push(`ability weight did not clear after a cancel (${ab.cancelSettledW.toFixed(2)})`);
// 5: the safe-area guard, in open floor where it is the only thing deciding.
if (ab.aimNorthY >= cfg.ctrlTop)
  fails.push(`aiming north in open floor put the player at screen y ${ab.aimNorthY.toFixed(0)}, at or below the control edge (${cfg.ctrlTop})`);
if (ab.aimNorthExtremeY >= cfg.ctrlTop)
  fails.push(`with an absurd vertical ability lead the player reached screen y ${ab.aimNorthExtremeY.toFixed(0)} — the safe-area guard is not enforcing the limit`);
// Both endings return to the same Phase 2A composition.
for (const [what, x] of [['after a melee', ab.meleeSettledX], ['after a cancel', ab.cancelSettledX]])
  if (Math.abs(x - ab.idleX) > cfg.cam.dzX + 8)
    fails.push(`${what} the player rests ${Math.abs(x - ab.idleX).toFixed(0)}px from the idle composition — the camera did not settle back into Phase 2A framing`);

// ── PHASE 2C — ORDINARY COMBAT INTENT ─────────────────────────────────────
//
// Relational claims only: one shot is noise, consistent shots are intent,
// opposing shots cancel, intent expires, and an explicit ability still wins.
// Fed through `noteShot` — the exact entry point the two committed-fire
// handlers call — at the game's own cadence (a 120ms pistol cooldown, three
// rounds, a 520ms reload: a shot roughly every 180ms sustained).
const aim = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { ROOMS } = await import('/src/data/rooms.js');
  gs.loadRoom(ROOMS.find((r) => r.id === 'detention'));
  const c = gs.cameras.main, d = gs.cameraDirector, p = gs.player;
  const step = (ms) => { for (let i = 0; i < Math.round(ms / 16); i++) d.update(16); };
  const clear = () => {
    p.setPosition(800, 700); p.setVelocity(0, 0);
    p._moveTargetX = 0; p._moveTargetY = 0;
    p.superAiming = false; p.meleeAiming = false; p.resetMeleeCombo();
    d.reset(800, 700); d._fvX = 0; d._fvY = 0; d._fvW = 0; d._aimX = 0; d._aimY = 0;
    step(400);
  };
  const shoot = (a, gap = 180) => { d.noteShot(a); step(gap); };
  const conf = () => Math.hypot(d._aimX, d._aimY);
  const sx = () => (p.x - c.scrollX) * c.zoom + c.x;
  const out = {};

  // 6 — inert until an ordinary shot actually happens.
  clear();
  out.idleConf = conf();
  out.idleX = sx();

  // 1 + 2 — one shot is noise; repeated consistent shots are intent.
  clear(); shoot(0, 200);
  out.oneShot = conf();
  out.oneShotX = sx();
  clear(); for (let i = 0; i < 6; i++) shoot(0);
  out.sixShots = conf();
  out.sixShotsX = sx();

  // 3 — opposing directions cancel rather than swing the frame.
  clear();
  const xs = [];
  for (let i = 0; i < 8; i++) { shoot(i % 2 ? Math.PI : 0); xs.push(sx()); }
  out.altConf = conf();
  out.altSwing = Math.max(...xs) - Math.min(...xs);

  // 4 — it expires.
  clear(); for (let i = 0; i < 6; i++) shoot(0);
  out.beforeDecay = conf();
  step(2000);
  out.afterDecay = conf();

  // 5 — an explicit ability still outranks it, and nothing stale snaps back.
  clear(); for (let i = 0; i < 6; i++) shoot(0);
  out.combatX = sx();
  p.superCharge = 99;
  p.setSuperAimInput({ x: -1, y: 0, force: 1 });     // aiming WEST against east fire
  step(400);
  out.abilityX = sx();
  out.abilityW = d._abW;
  p.superAiming = false;
  let jump = 0, prev = sx();
  for (let i = 0; i < 12; i++) { step(60); const n = sx(); jump = Math.max(jump, Math.abs(n - prev)); prev = n; }
  out.releaseJump = jump;

  // 7 — the safe area, with sustained fire NORTH: the bearing that pushes the
  // player DOWN the screen. Staged in open floor in the room's southern half,
  // where neither a wall nor the northern framing edge is already deciding.
  p.setPosition(800, 1050); p.setVelocity(0, 0);
  p._moveTargetX = 0; p._moveTargetY = 0;
  p.superAiming = false;
  d.reset(800, 1050); d._fvX = 0; d._fvY = 0; d._fvW = 0; d._aimX = 0; d._aimY = 0;
  step(300);
  for (let i = 0; i < 10; i++) { d.noteShot(-Math.PI / 2); p.setPosition(800, 1050); step(180); }
  out.fireNorthY = (p.y - c.scrollY) * c.zoom + c.y;
  out.fireNorthConf = conf();
  const savedY = d.cfg.aimLeadY;
  d.cfg.aimLeadY = 900;                              // far past anything shippable
  step(400);
  out.fireNorthExtremeY = (p.y - c.scrollY) * c.zoom + c.y;
  d.cfg.aimLeadY = savedY;

  d._fvX = 0; d._fvY = 0; d._fvW = 0; d._aimX = 0; d._aimY = 0;
  return out;
});

if (aim.idleConf !== 0)
  fails.push(`combat confidence is ${aim.idleConf} with no shots fired — ordinary intent must be inert until an ordinary shot happens`);
// ONE SHOT IS NOISE. Not zero influence, but it must not move the frame.
if (!(aim.oneShot > 0 && aim.oneShot < 0.45))
  fails.push(`one shot produced confidence ${aim.oneShot.toFixed(2)} — a single tap must register weakly, not decide the composition`);
if (Math.abs(aim.oneShotX - aim.idleX) > 24)
  fails.push(`one shot moved the player ${Math.abs(aim.oneShotX - aim.idleX).toFixed(0)}px on screen — a tap should not recompose the room`);
// REPEATED CONSISTENT SHOTS ARE INTENT.
if (!(aim.sixShots > aim.oneShot * 2))
  fails.push(`six consistent shots reached ${aim.sixShots.toFixed(2)} against one shot's ${aim.oneShot.toFixed(2)} — consistency is not accumulating`);
const opened = aim.idleX - aim.sixShotsX;
if (opened < 80)
  fails.push(`six shots east opened only ${opened.toFixed(0)}px of view in that direction`);
// ...AND NOT AS HARD AS AN EXPLICIT PREVIEW.
if (opened > (cfg.cam.abilityLeadX - cfg.cam.dzX))
  fails.push(`ordinary fire moved the frame ${opened.toFixed(0)}px, at or past what an explicit ability preview commands — the fire button is steering the camera`);
// OPPOSING SHOTS CANCEL — and the pair matters: a camera that never moves at
// all would also pass this on its own.
if (aim.altConf > 0.3)
  fails.push(`alternating east/west fire still reached confidence ${aim.altConf.toFixed(2)} — opposing evidence is not cancelling`);
if (aim.altSwing > 40)
  fails.push(`alternating fire swung the player ${aim.altSwing.toFixed(0)}px across 8 shots — this is the target-switch ping-pong the design forbids`);
// IT EXPIRES.
if (!(aim.afterDecay < aim.beforeDecay * 0.15))
  fails.push(`combat intent was still ${aim.afterDecay.toFixed(2)} two seconds after the last shot (peak ${aim.beforeDecay.toFixed(2)}) — a stale sector is steering the camera`);
// EXPLICIT COMMITMENT STILL WINS.
if (!(aim.abilityW > 0.9) || (aim.abilityX - aim.combatX) < 150)
  fails.push(`an ability aimed west against east fire only moved the frame ${(aim.abilityX - aim.combatX).toFixed(0)}px (weight ${aim.abilityW.toFixed(2)}) — ordinary fire is competing with explicit intent`);
if (aim.releaseJump > 60)
  fails.push(`the frame jumped ${aim.releaseJump.toFixed(0)}px in one 60ms step after the ability ended — stale combat memory is snapping the camera back`);
// THE SAFE AREA HOLDS, INCLUDING UNDER AN ABSURD VERTICAL COMBAT LEAD.
if (aim.fireNorthY >= cfg.ctrlTop)
  fails.push(`sustained fire north put the player at screen y ${aim.fireNorthY.toFixed(0)}, at or below the control edge (${cfg.ctrlTop})`);
if (aim.fireNorthExtremeY >= cfg.ctrlTop)
  fails.push(`with an absurd vertical combat lead the player reached screen y ${aim.fireNorthExtremeY.toFixed(0)} — the safe-area guard is not enforcing the limit`);

// ── PHASE 3A — EXTERNAL THREAT INTEREST ───────────────────────────────────
//
// Relational claims only, and every one of them is a matched pair or it proves
// nothing: "a comfortably visible Vader must not pull the frame" is satisfied
// by a layer that does nothing at all, so it is only meaningful next to "a
// Vader falling off the edge must". Driven through a REAL spawned boss —
// `scene.boss` is the layer's only input, and a fake object would not exercise
// the one property that makes afterimages structurally exempt.
const bs = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { ROOMS } = await import('/src/data/rooms.js');
  const { PLAYER } = await import('/src/config.js');
  gs.loadRoom(ROOMS.find((r) => r.id === 'detention'));
  gs.lives = 9999; gs.player.hp = gs.player.hpMax = 1e9;
  const c = gs.cameras.main, d = gs.cameraDirector, p = gs.player;
  const out = {};

  const clean = () => {
    for (const e of gs.enemies.getChildren().slice()) e.destroy();
    if (gs.boss) { try { gs.boss.shadow?.destroy(); gs.boss.hpBar?.destroy(); gs.boss.destroy(); } catch (_) {} gs.boss = null; }
    if (gs._cameraPunchTween) { gs._cameraPunchTween.stop(); gs._cameraPunchTween = null; }
    c.setZoom(1);
  };
  const boss = (bx, by) => { clean(); gs.spawnBoss(bx, by, { encounter: 1 }); gs.boss.hp = gs.boss.hpMax = 1e9; return gs.boss; };
  const stage = (px, py) => {
    p.alive = true; p.setActive(true).setVisible(true).setAlpha(1);
    p.setPosition(px, py); p.setVelocity(0, 0);
    p._moveTargetX = 0; p._moveTargetY = 0;
    p.superAiming = false; p.meleeAiming = false; p.resetMeleeCombo();
    p.superCharge = 99; p.meleeCharge = 99;
    d.reset(px, py);
    d._fvX = 0; d._fvY = 0; d._fvW = 0; d._aimX = 0; d._aimY = 0;
    d._bsX = 0; d._bsY = 0; d._bsW = 0;
  };
  // Vader's own AI writes velocity every frame; the camera is what is under
  // test, so he is pinned. The live-fight case belongs in the diag rig.
  const run = (n, b, bx, by, px, py) => {
    for (let i = 0; i < n; i++) {
      if (b) { b.setPosition(bx, by); b.body?.setVelocity(0, 0); }
      p.setPosition(px, py); p.setVelocity(0, 0);
      d.update(16);
    }
  };
  const sx = () => (p.x - c.scrollX) * c.zoom + c.x;
  const lead = () => Math.hypot(d._bsX, d._bsY);

  // 1 — NO BOSS, NO CONTRIBUTION. The layer must be inert in every room that
  // is not a boss fight, which is most of the game.
  clean(); stage(800, 700); run(120, null, 0, 0, 800, 700);
  out.noBossLead = lead();
  out.noBossW = d._bsW;
  out.noBossX = sx();

  // 2 — COMFORTABLY VISIBLE. 220px east of a standing player is well inside
  // the comfort inset: if he is already readable the approved camera is left
  // alone, whatever else is true about him.
  {
    const b = boss(1020, 700); stage(800, 700); run(140, b, 1020, 700, 800, 700);
    out.visibleW = d._bsW; out.visibleLead = lead(); out.visibleX = sx();
  }

  // 3 — THE OTHER HALF OF THE PAIR. Same player, Vader at the edge. Without
  // this, 2 passes on a layer that has been deleted.
  {
    const b = boss(1300, 700); stage(800, 700); run(160, b, 1300, 700, 800, 700);
    out.edgeW = d._bsW; out.edgeLead = lead(); out.edgeX = sx();
    out.edgeDir = d._bsX;
  }

  // 4 — BOUNDED, at an absurd separation. The cap is on the FILTERED value, so
  // no combination of need, axis and distance may exceed it.
  {
    const b = boss(1560, 1340); stage(200, 200); run(220, b, 1560, 1340, 200, 200);
    out.farLead = lead();
  }

  // 5 — EXPLICIT COMMITMENT OUTRANKS HIM. A Super aimed west while Vader sits
  // at the eastern edge: the boss request must collapse while the preview is
  // armed, and come back after it.
  {
    const b = boss(1300, 700); stage(800, 700); run(120, b, 1300, 700, 800, 700);
    out.preAbilityLead = lead();
    p.setSuperAimInput({ x: -1, y: 0, force: 1 });
    run(120, b, 1300, 700, 800, 700);
    out.underAbilityW = d._bsW; out.underAbilityLead = lead(); out.underAbilityAbW = d._abW;
    p.superAiming = false;
    run(200, b, 1300, 700, 800, 700);
    out.postAbilityLead = lead();
  }

  // 6 — AFTERIMAGES ARE NOT VADER. Six clones east, the real Vader dead. The
  // layer reads `scene.boss` and nothing else, so this is a structural claim
  // rather than an exclusion rule — and it is asserted with a live scroll,
  // because "the weight is zero" would also pass on a stuck camera.
  {
    const b = boss(1300, 700); stage(800, 700); run(120, b, 1300, 700, 800, 700);
    out.beforeClonesLead = lead();
    gs._spawnAfterimages(b, 6);
    b.alive = false; b.setActive(false).setVisible(false);
    run(240, null, 0, 0, 800, 700);
    out.clones = gs.enemies.getChildren().filter((e) => e.active && e._afterimage).length;
    out.clonesW = d._bsW; out.clonesLead = lead(); out.clonesX = sx();
  }

  // 7 — THE SOUTH GUARANTEE, AT THE ONE BEARING THAT COULD SPEND IT. A Vader
  // NORTH of the player pulls the focus north, which draws the player DOWN the
  // screen. Staged in the southern OPEN FLOOR, not at the wall: at a wall the
  // framing clamp pins the player anyway and this passes with the guard
  // deleted. Measured at the configured lead and again at a deliberately
  // absurd one, because a guard that cannot be shown to engage is decoration.
  {
    const py = 1050, px = 800, by = py - 620;
    const b = boss(px, by);
    stage(px, py); run(220, b, px, by, px, py);
    out.southY = (p.y - c.scrollY) * c.zoom + c.y;
    out.southLead = d._bsY;
    const sl = d.cfg.bossLeadY, sm = d.cfg.bossLeadMax;
    d.cfg.bossLeadY = 900; d.cfg.bossLeadMax = 900;
    run(300, b, px, by, px, py);
    out.southExtremeY = (p.y - c.scrollY) * c.zoom + c.y;
    out.southExtremeLead = d._bsY;
    d.cfg.bossLeadY = sl; d.cfg.bossLeadMax = sm;
  }

  clean(); stage(800, 700);
  return out;
});

// 8 — VANISH, AND ITS THREE INTERVALS ARE THREE DIFFERENT CLAIMS.
//
// The move is not one state. He winds up VISIBLY, standing on his real spot;
// then he departs and the sprite left behind is a place he is not; then he
// commits somewhere else. A whole-move gate collapses those into one and
// suppresses ordinary awareness of an ordinary attack because of something
// that has not happened yet, so this samples all three separately.
//
// CLASSIFIED BY OBSERVED STATE, NEVER BY WALL CLOCK. This harness runs the
// move's own clock several times slower than real time — a 620ms wind-up
// measured 3.8 SECONDS on a cold container and a few frames on a warm one — so
// anything keyed on elapsed ms, or on a SAMPLE COUNT, is measuring the machine.
// `phase` and the move's own `bodyAuthoritative` are the boundary and they are
// true at any frame rate.
//
// HE IS PINNED UNTIL THE CAST. The acquisition window exists so the wind-up is
// measured on an already-live lead rather than one still ramping from zero —
// but his AI walks him at the player during it, which closes the distance and
// quietly turns the station into one where composition does NOT need him. The
// first version of this check measured need 0.20 for exactly that reason.
await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const d = gs.cameraDirector, p = gs.player, c = gs.cameras.main;
  for (const e of gs.enemies.getChildren().slice()) e.destroy();
  if (gs.boss) { try { gs.boss.shadow?.destroy(); gs.boss.hpBar?.destroy(); gs.boss.destroy(); } catch (_) {} gs.boss = null; }
  p.alive = true; p.setActive(true).setVisible(true).setAlpha(1);
  p.setPosition(800, 700); p.setVelocity(0, 0);
  p._moveTargetX = 0; p._moveTargetY = 0;
  p.superAiming = false; p.meleeAiming = false;
  gs.spawnBoss(1300, 700, { encounter: 1 });
  gs.boss.hp = gs.boss.hpMax = 1e9;
  d.reset(800, 700);
  window.__V = { cast: false, rows: [], pre: null, pinned: true, prevLead: null };
  window.__vanishHook = () => {
    const b = gs.boss; if (!b) return;
    const V = window.__V;
    // Hold him at the eastern edge until the cast, so the station stays one
    // where the composition genuinely needs him. VANISH plants him itself for
    // the wind-up, so nothing has to hold him after that.
    if (V.pinned) { b.setPosition(1300, 700); b.body?.setVelocity(0, 0); }
    const lead = Math.hypot(d._bsX, d._bsY);
    const dt = gs.game.loop.delta;
    if (V.pinned) { V.pre = { w: d._bsW, lead }; V.prevLead = lead; return; }
    const m = b._activeMove;
    if (m?.move?.id !== 'vanishslash') { V.prevLead = lead; return; }
    V.rows.push({
      phase: m.phase, auth: m.bodyAuthoritative,
      alpha: +b.alpha.toFixed(2), vis: !!b.visible,
      framable: d._bossFramable(b),
      w: +d._bsW.toFixed(2), lead, dt,
      dLead: V.prevLead === null ? 0 : Math.abs(lead - V.prevLead),
      scrollX: c.scrollX,
    });
    V.prevLead = lead;
  };
  gs.events.on('postupdate', window.__vanishHook);
  await new Promise((r) => setTimeout(r, 1200));   // acquire, pinned
  // A REFUSED CAST READS EXACTLY LIKE A FAILED ONE, and after a second of
  // acquisition his own state machine owns him: `_castBossMove` refuses unless
  // he is idle, unguarded and running no scripted move. So the precondition is
  // established rather than hoped for, and the refusal context is carried out
  // for the report if it still will not take.
  const b = gs.boss;
  for (let i = 0; i < 12 && !window.__V.cast; i++) {
    b._activeMove?.cancel?.();
    b.state = 'idle';
    window.__V.why = { state: b.state, guarding: !!b.isGuarding?.(), move: b._activeMove?.phase ?? null, playerAlive: gs.player.alive };
    window.__V.cast = !!gs._castBossMove(b, 'vanishslash');
    if (!window.__V.cast) await new Promise((r) => setTimeout(r, 200));
  }
  window.__V.pinned = false;
});
// Generous: 620+700+750ms nominal, and this harness runs that clock several
// times slower. The classification does not care how long it takes.
await page.waitForTimeout(16000);
const van = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  gs.events.off('postupdate', window.__vanishHook);
  gs.boss?._activeMove?.cancel?.();
  const V = window.__V, d = gs.cameraDirector;
  // `!== false` rather than `=== true` ON PURPOSE. A build with no such claim
  // at all (the whole-move gate this replaces) then classifies its entire
  // wind-up as EARLY and fails on the behaviour — "he was unframable while
  // visibly standing there" — instead of passing vacuously on an empty set
  // because a field it never had was missing.
  const early = V.rows.filter((r) => r.phase === 'anticipate' && r.auth !== false);
  const gone  = V.rows.filter((r) => r.phase === 'anticipate' && r.auth === false);
  const after = V.rows.filter((r) => r.phase !== 'anticipate');
  // The interval where `Boss.preUpdate` has put his alpha back while he is
  // still absent — the trap a sprite-alpha authority would fall into.
  const restored = gone.filter((r) => r.alpha >= 0.99 && r.vis);
  // NO POP, MEASURED AGAINST THE FILTER RATHER THAN IN PIXELS PER FRAME. A raw
  // px/frame threshold measures how long a frame was — the post-mortem's own
  // example of an instrument that is really a frame-rate meter. The boss lead
  // is a one-pole filter, so the most it may move in a frame of `dt` is the
  // full range times `1 - exp(-dt/bossAttackMs)`; anything beyond that is a
  // discontinuity rather than a fast fade.
  let worst = 0, worstAt = null;
  for (const r of V.rows) {
    const bound = d.cfg.bossLeadMax * (1 - Math.exp(-r.dt / d.cfg.bossAttackMs)) + 2;
    if (r.dLead / bound > worst) { worst = r.dLead / bound; worstAt = { d: +r.dLead.toFixed(1), bound: +bound.toFixed(1), phase: r.phase, auth: r.auth }; }
  }
  return {
    cast: V.cast, why: V.why, total: V.rows.length, pre: V.pre,
    early: { n: early.length, framable: early.filter((r) => r.framable).length, maxW: Math.max(0, ...early.map((r) => r.w)), maxLead: Math.max(0, ...early.map((r) => r.lead)) },
    gone:  { n: gone.length,  framable: gone.filter((r) => r.framable).length,  maxW: Math.max(0, ...gone.map((r) => r.w)) },
    restored: { n: restored.length, framable: restored.filter((r) => r.framable).length },
    after: { n: after.length, framable: after.filter((r) => r.framable).length, firstFramable: after[0]?.framable ?? null },
    filterRatio: worst, worstAt,
  };
});

// 1 — inert with no boss at all.
if (bs.noBossLead !== 0 || bs.noBossW !== 0)
  fails.push(`the boss layer contributed ${bs.noBossLead.toFixed(1)}px with no boss in the room — it must be inert outside a boss fight`);
// 2 + 3 — THE MATCHED PAIR. Silent when he is readable, present when he is not.
if (bs.visibleW > 0.01 || bs.visibleLead > 1)
  fails.push(`a comfortably visible Vader still asked for ${bs.visibleLead.toFixed(0)}px (need ${bs.visibleW.toFixed(2)}) — the layer is a tether, not a guardrail`);
if (!(bs.edgeW > 0.5))
  fails.push(`a Vader at the frame edge only reached need ${bs.edgeW.toFixed(2)} — the awareness this pass exists for is not engaging`);
if (!(bs.edgeLead > 40))
  fails.push(`a Vader at the frame edge bought back only ${bs.edgeLead.toFixed(0)}px of frame`);
if (!(bs.edgeDir > 0))
  fails.push('the boss lead points AWAY from a Vader at the eastern edge — the sign is inverted');
if (!(bs.edgeX < bs.visibleX))
  fails.push('the frame did not open toward an edge-bound Vader relative to a comfortable one');
// 4 — BOUNDED. This is the difference between awareness and ownership.
if (!(bs.farLead <= cfg.cam.bossLeadMax + 1))
  fails.push(`a distant offscreen Vader produced ${bs.farLead.toFixed(0)}px, past the ${cfg.cam.bossLeadMax}px cap — the boss term is unbounded`);
// 5 — explicit commitment wins, and nothing is stranded afterwards.
if (!(bs.preAbilityLead > 40))
  fails.push('the boss lead was not open before the ability, so the suppression check below proves nothing');
if (!(bs.underAbilityAbW > 0.9))
  fails.push(`the Super preview only reached ability weight ${bs.underAbilityAbW.toFixed(2)} — the priority case is not being exercised`);
if (bs.underAbilityW > 0.05 || bs.underAbilityLead > 12)
  fails.push(`an armed Super left ${bs.underAbilityLead.toFixed(0)}px of boss lead (need ${bs.underAbilityW.toFixed(2)}) — explicit commitment must outrank an external interest`);
if (!(bs.postAbilityLead > 40))
  fails.push('the boss lead did not return after the ability released — suppression became deletion');
// 6 — afterimages drag nothing.
if (bs.clones < 3)
  fails.push(`only ${bs.clones} afterimages were alive — the check below proves nothing about clones`);
if (bs.clonesW !== 0 || bs.clonesLead > 1)
  fails.push(`six afterimages held ${bs.clonesLead.toFixed(0)}px of boss lead (need ${bs.clonesW.toFixed(2)}) — a clone is dragging the camera`);
if (!(bs.beforeClonesLead > 40))
  fails.push('the boss lead was never open before the clones were spawned, so 6 proves nothing');
// 7 — the south guarantee survives an external interest, including an absurd one.
if (bs.southY >= cfg.ctrlTop)
  fails.push(`with Vader north of a player at the south wall the player is at screen y ${bs.southY.toFixed(0)}, at or below the control edge (${cfg.ctrlTop})`);
if (!(Math.abs(bs.southExtremeLead) > Math.abs(bs.southLead) * 2))
  fails.push(`the absurd boss lead only reached ${bs.southExtremeLead.toFixed(0)}px against the configured ${bs.southLead.toFixed(0)}px — the extreme probe is not engaging, so the check below is decoration`);
if (bs.southExtremeY >= cfg.ctrlTop)
  fails.push(`with an absurd boss lead the player reached screen y ${bs.southExtremeY.toFixed(0)} — the safe-area guard is not enforcing the limit on the boss term`);
// 8 — VANISH's three intervals, A to E.
if (!van.cast)
  fails.push(`the VANISH cast was REFUSED — every check below proves nothing (last refusal context: ${JSON.stringify(van.why)})`);
// A SAMPLE COUNT IS A FRAME-RATE READING HERE, so the floor is existence only:
// the departure window is 260ms of the move's own clock and lands anywhere
// between one frame and fifteen depending on how warm the box is.
for (const [k, n] of [['early wind-up', van.early.n], ['departed', van.gone.n], ['committed', van.after.n]])
  if (!(n >= 1)) fails.push(`no VANISH samples at all in the ${k} interval — that interval was never observed`);
// A — the EARLY wind-up is an ordinary boss winding up in plain sight, and it
// must still buy frame when the composition needs it. Both halves: he is
// framable, AND the need was real, or this passes on a dead layer.
if (van.early.framable !== van.early.n)
  fails.push(`Vader was unframable in ${van.early.n - van.early.framable}/${van.early.n} frames of the VISIBLE VANISH wind-up — a whole-move gate is suppressing awareness of an attack that has not teleported yet`);
// The station has to be one where composition needs him, or A is vacuous —
// measured on the pinned pre-cast frame, which does not depend on how many
// frames the wind-up happened to get.
if (!(van.pre && van.pre.w > 0.5 && van.pre.lead > 20))
  fails.push(`before the cast the layer held need ${van.pre?.w?.toFixed(2)} / ${van.pre?.lead?.toFixed(0)}px — the station is not one where composition needs him, so A proves nothing`);
if (!(van.early.maxLead > 20))
  fails.push(`the early VANISH wind-up produced only ${van.early.maxLead.toFixed(0)}px of boss lead — ordinary bounded interest is not being produced`);
if (van.early.maxLead > cfg.cam.bossLeadMax + 1)
  fails.push(`the early VANISH wind-up produced ${van.early.maxLead.toFixed(0)}px, past the ${cfg.cam.bossLeadMax}px cap`);
// B — once he has departed, zero. Not reduced: zero.
if (van.gone.framable !== 0)
  fails.push(`Vader was framable in ${van.gone.framable}/${van.gone.n} frames AFTER he departed — the camera is composing on a body he has left`);
if (van.gone.maxW !== 0)
  fails.push(`the departed interval still asked for need ${van.gone.maxW.toFixed(2)} — it must contribute nothing at all`);
// C — the alpha restoration is a trap, and it must not reacquire him. If this
// interval is empty the check is vacuous, so its existence is asserted too.
if (!(van.restored.n >= 1))
  fails.push('never observed the fully-opaque old-position interval — C is vacuous (Boss.preUpdate restores alpha partway through the wind-up, so it should occur)');
if (van.restored.framable !== 0)
  fails.push(`the restored-alpha old-position sprite was framable in ${van.restored.framable} frames — sprite alpha is being trusted over the move's own claim`);
// D — the committed position is authoritative again, from the first frame.
if (van.after.firstFramable !== true)
  fails.push('Vader was not framable on the first frame after he committed to the new position — reacquisition is late');
if (van.after.framable !== van.after.n)
  fails.push(`Vader was unframable in ${van.after.n - van.after.framable}/${van.after.n} frames after committing`);
// E — and none of the three transitions may pop the frame. The boss filter is
// the slowest in the composition precisely so this holds.
if (van.filterRatio > 1)
  fails.push(`the boss lead moved ${JSON.stringify(van.worstAt)} — beyond what its own filter permits in that frame, so a transition is a step rather than a fade`);

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
    // The last two stations arm an ABILITY aiming NORTH — the one bearing that
    // pushes the player DOWN the screen, and therefore the only way Phase 2B
    // could spend the Phase 1 south win. `_clampSafeArea` is what refuses it.
    for (const [name, fx, dir, aim] of [
      ['S-w', 0.5, -1, null], ['S-e', 0.5, 1, null],
      ['SW', 0, -1, null], ['SE', 1, 1, null], ['SW-e', 0, 1, null], ['SE-w', 1, -1, null],
      ['S-aimN', 0.5, 0, -Math.PI / 2], ['SE-aimN', 1, 0, -Math.PI / 2],
    ]) {
      const px = rad + fx * (w - rad * 2), py = h - rad;
      p.setPosition(px, py); p.setVelocity(0, 0);
      p._moveTargetX = dir * PLAYER.speed; p._moveTargetY = 0;
      p.superAiming = false; p.meleeAiming = false;
      d.reset(px, py);
      if (aim !== null) { p.superCharge = 99; p.setSuperAimInput({ x: Math.cos(aim), y: Math.sin(aim), force: 1 }); }
      for (let i = 0; i < 140; i++) { p.setPosition(px, py); d.update(16); }
      out.push({
        name,
        screenX: (px - c.scrollX) * c.zoom + c.x,
        screenY: (py - c.scrollY) * c.zoom + c.y,
        lead: d._leadX,
      });
    }
    p._moveTargetX = 0; p._moveTargetY = 0;
    p.superAiming = false; p.meleeAiming = false;
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
