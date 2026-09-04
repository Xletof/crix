// CameraDirector — the camera that frames the game, instead of following the
// player.
//
// PHASE 1. What this replaces was one line: `startFollow(player, true, 0.22,
// 0.22)`, plus a `setFollowOffset` lookahead and a speed-tied zoom breathe. It
// behaved as a TRACKER — the world moved because the player moved, and every
// step dragged the whole frame — and it failed outright at the south wall. In
// all four frozen arenas the camera clamps ~200px before the player does, so
// the last stretch of southward walking is the player sliding down the screen
// into the touch controls. Measured at the south wall: player at SCREEN y
// 1253-1258 with the move stick's top edge at 1064.
//
// TWO SOLVERS, AND THE SPLIT IS THE POINT.
//
//   COMPOSITION  — where should the camera WANT to be? (`_solveTarget`)
//                  The player, a MOVEMENT LEAD (Phase 2A), an above-centre
//                  resting anchor, a soft deadzone and the room's framing rect.
//                  Later phases enrich the FOCUS (`_solveFocus`) with aim
//                  intent, then Vader and his attack state. None of them touch
//                  the motion solver — that is what the split is for, and the
//                  movement lead is the first thing to prove it: Phase 2A added
//                  a whole new interest and changed not one line of `_spring`.
//   MOTION       — how does the camera TRAVEL there? (`_solveMotion`)
//                  A critically damped spring with a hard lag ceiling. It knows
//                  nothing about what it is chasing and never will.
//
// THREE THINGS THAT MAKE THIS WORK, AND EACH OF THEM IS LOAD-BEARING:
//
//  * THE DEADZONE IS WHERE THE STABILITY COMES FROM, NOT THE DAMPING. Inside
//    it the target does not move at all, so the world genuinely holds still
//    while the player crosses the frame. Damping alone is the same glued
//    follow with a slower glue — the thing this pass exists to stop.
//  * X AND Y ARE NOT THE SAME CAMERA. The handset approved Phase 1's vertical
//    feel and rejected its lateral one, so Phase 2A tightened the horizontal
//    deadzone, stiffened the horizontal spring and spent the whole lookahead
//    budget on X — and left every vertical number exactly where it was. The
//    answer to "lateral movement lags" is a better X composition, never a
//    faster camera.
//  * CAMERA BOUNDS ARE NOT COLLISION BOUNDS. The camera frames past the room's
//    edge (`_framing`); the room, its walls and its physics bounds are
//    untouched. That freedom is the only thing that can keep a player standing
//    at the southern wall above the controls, because at that point the player
//    has stopped moving and only the frame can still change.
//  * THE SPRING IS INTEGRATED IMPLICITLY. `v += (-2wv - w^2 x)dt` is
//    conditionally stable and rings at large dt, and this project's harness
//    runs at ~20fps — an explicit integrator would oscillate on the machine
//    that reviews it and not on the phone. The implicit form below cannot
//    overshoot at any step size.
import Phaser from 'phaser';
import { CAMERA, VIEW, HUDCFG, PLAYER } from '../config.js';
import { getControls } from './controlLayout.js';

export class CameraDirector {
  constructor(scene) {
    this.scene = scene;
    this.cam = scene.cameras.main;

    // Target scroll — the composition solver's output, and the spring's input.
    // It is STATE, not a pure function of the player: that persistence is what
    // a deadzone is. `_ready` false means nothing has framed yet.
    this._tx = 0;
    this._ty = 0;
    this._vx = 0;   // spring velocity, px/s
    this._vy = 0;
    this._ready = false;

    // Framing rect (room bounds + padding). Set per room.
    this._framing = { x: 0, y: 0, w: VIEW.width, h: VIEW.height };

    // Filtered movement lead (Phase 2A). It is STATE, and deliberately so —
    // the whole claim of a lead built from intent rather than from raw input is
    // that it takes a moment to open and a moment to close.
    this._leadX = 0;
    this._leadY = 0;

    // Scratch. The whole per-frame path is ~30 arithmetic operations and it
    // runs every frame forever, so it allocates NOTHING: the focus, the ideal
    // scroll and the two spring results are written into these instead of
    // returned as object literals. Four small objects a frame is not a frame
    // budget problem on its own — it is a garbage-collection pause on a phone
    // in a fight, which is the only kind of camera stutter that is invisible in
    // a profile and obvious in the hand.
    this._fx = 0; this._fy = 0;     // focus
    this._ix = 0; this._iy = 0;     // ideal scroll for that focus
    this._sx = 0; this._sv = 0;     // spring result

    this._dbg = null;
  }

  // ── Gameplay-safe area ────────────────────────────────────────────────────
  //
  // Not all 720x1280 logical pixels are gameplay space. The camera viewport is
  // already inset below the HUD top bar; below, the sticks and the button
  // cluster own the bottom of the screen, and the thumbs holding them own more
  // than the sprites do.
  //
  // Read from the LIVE control layout rather than from HUDCFG, because the
  // player can move and resize every widget at Pause -> CONTROLS. A layout with
  // the buttons dragged upward is a layout that needs more framing freedom, and
  // this is the one place that can know it.
  //
  // Returns the bottom of the safe area in VIEWPORT pixels (0 = just below the
  // HUD bar). Default layout: the super button's top edge at screen 926, which
  // is viewport 842.
  safeBottom() {
    let top = VIEW.height;
    for (const c of getControls()) top = Math.min(top, c.y - c.radius);
    return top - this.cam.y;
  }

  // SOUTH PADDING IS DERIVED, AND THE ROOM HEIGHT CANCELS OUT OF IT.
  //
  // Standing at the south wall the player is at world `h - PLAYER.radius`, and
  // the unpadded camera can only scroll to `h - viewH`. So the player's
  // viewport y there is `viewH - PLAYER.radius`, whatever the room is — 1174 on
  // a 1196-tall viewport, which is under everything. Wanting them at
  // `safeBottom - southClearance` instead costs exactly the difference, and
  // that difference has no `h` in it.
  _solvePadSouth() {
    const viewH = this.cam.height / this.cam.zoom;
    const want = this.safeBottom() - CAMERA.southClearance;
    const pad = viewH - PLAYER.radius - want;
    return Phaser.Math.Clamp(Math.round(pad), CAMERA.padSouthMin, CAMERA.padSouthMax);
  }

  // ── Room framing ──────────────────────────────────────────────────────────
  //
  // Called from `loadRoom`, after the room's own bounds are set. A room may
  // override any padding through `spec.camera` — DATA, not a code branch, per
  // the brief: if the four frozen arenas ever disagree with the global numbers
  // it must be visible in the room file and nowhere else. None of them does
  // today, and none of them carries the key.
  setRoom(spec) {
    const { w, h } = spec.bounds;
    const o = spec.camera || {};
    const n = o.padNorth ?? CAMERA.padNorth;
    const s = o.padSouth ?? this._solvePadSouth();
    const e = o.padEast ?? o.padSide ?? CAMERA.padSide;
    const wl = o.padWest ?? o.padSide ?? CAMERA.padSide;

    this._framing = { x: -wl, y: -n, w: w + wl + e, h: h + n + s };
    // Phaser's own clamp is left pointed at the same rect, so the engine can
    // never disagree with `_clampScroll` about where the edge is.
    this.cam.setBounds(this._framing.x, this._framing.y, this._framing.w, this._framing.h);
  }

  // Snap to a fully composed frame with no travel. Room loads and respawns use
  // this: springing in from the previous room's scroll is a camera flying
  // across a level the player has never seen.
  reset(x, y) {
    this._idealScroll(x ?? this.scene.player?.x ?? 0, y ?? this.scene.player?.y ?? 0);
    this._tx = this._ix; this._ty = this._iy;
    this._clampTarget();
    this._vx = 0; this._vy = 0;
    this._leadX = 0; this._leadY = 0;
    this._ready = true;
    this.cam.setScroll(this._tx, this._ty);
  }

  // ── COMPOSITION SOLVER ────────────────────────────────────────────────────

  // WHAT THE CAMERA IS INTERESTED IN. Phase 1: the player, and nothing else.
  //
  // Phase 2 adds movement and aim intent here; Phase 3 blends Vader in and
  // weights him by his attack state. Every one of those is a change to this
  // method's return value and to nothing else in the file — which is the whole
  // reason it is a method with one caller instead of two lines inlined below.
  _solveFocus(delta) {
    const p = this.scene.player;
    this._solveLead(delta, p);
    this._fx = p.x + this._leadX;
    this._fy = p.y + this._leadY;
  }

  // ── MOVEMENT LOOKAHEAD (PHASE 2A) ─────────────────────────────────────────
  //
  // Look where the player is TRAVELLING, so committed lateral movement opens
  // the world ahead of them instead of revealing it once they are already
  // standing in it.
  //
  // IT IS DRIVEN BY INTENT, NOT BY VELOCITY, and the difference is the feature.
  // `Player.preUpdate` eases `body.velocity` toward `_moveTarget*` over an
  // acceleration ramp, so velocity is a LAGGED copy of what the player asked
  // for — leading off it would add the ramp's delay to the very lag this pass
  // exists to remove. `_moveTarget*` is the stick's own request and it is
  // current on the frame the thumb moves. Its magnitude carries the stick's
  // force, so a light touch gets a proportionally smaller lead for free and
  // only committed movement spends the whole budget.
  //
  // WHILE DASHING THE DASH'S OWN HEADING WINS. A dash can be vault-locked onto
  // a cover spot up to 35 degrees off the stick (`Player.tryDash`), and the
  // camera has to look where the body is actually going. It also means a dash
  // that outlives the input keeps its lead open until it ends, which is what
  // stops the camera snapping back on the frame the dash finishes.
  //
  // ONE FILTER, TWO TIME CONSTANTS, NO REVERSAL SPECIAL CASE. A hard reversal
  // is simply a large error against the attack constant, so the lead crosses
  // through neutral and catches the new side on its own; a stop is the only
  // thing that switches to the slower release constant. A reversal branch here
  // would be a second author for the same number and would have to agree with
  // this one about what "reversing" means.
  _solveLead(delta, p) {
    let tx = 0, ty = 0;
    if (p.alive) {
      let ix = p._moveTargetX || 0;
      let iy = p._moveTargetY || 0;
      let commit = Math.min(1, Math.hypot(ix, iy) / (PLAYER.speed * (p.moveMult || 1)));
      if (p.isDashing && Number.isFinite(p.dashAngle)) {
        ix = Math.cos(p.dashAngle); iy = Math.sin(p.dashAngle);
        commit = CAMERA.leadDashMult;
      }
      const m = Math.hypot(ix, iy);
      if (m > 1e-4 && commit > 0) {
        tx = (ix / m) * CAMERA.leadX * commit;
        ty = (iy / m) * CAMERA.leadY * commit;
      }
    }
    // `delta` is clamped for the same reason the spring clamps it: a stalled
    // tab must not resolve as one enormous step.
    const tau = (tx === 0 && ty === 0) ? CAMERA.leadReleaseMs : CAMERA.leadAttackMs;
    const k = 1 - Math.exp(-Math.min(delta, 100) / tau);
    this._leadX += (tx - this._leadX) * k;
    this._leadY += (ty - this._leadY) * k;
  }

  // The scroll that would put `(fx, fy)` exactly on the resting anchor.
  // Divided by zoom because a viewport fraction is screen pixels and scroll is
  // world pixels; they are the same number only while zoom is 1, and
  // `_cameraPunch` briefly makes it not.
  _idealScroll(fx, fy) {
    const z = this.cam.zoom;
    this._ix = fx - (CAMERA.anchorX * this.cam.width) / z;
    this._iy = fy - (CAMERA.anchorY * this.cam.height) / z;
  }

  _clampTarget() {
    const z = this.cam.zoom;
    const viewW = this.cam.width / z, viewH = this.cam.height / z;
    const f = this._framing;
    // A framing rect narrower than the view (impossible with the current rooms,
    // but a room is data) centres rather than inverting its own bounds.
    this._tx = f.w <= viewW ? f.x + (f.w - viewW) / 2
      : Phaser.Math.Clamp(this._tx, f.x, f.x + f.w - viewW);
    this._ty = f.h <= viewH ? f.y + (f.h - viewH) / 2
      : Phaser.Math.Clamp(this._ty, f.y, f.y + f.h - viewH);
  }

  // THE DEADZONE, EXPRESSED ON THE TARGET RATHER THAN ON THE PLAYER.
  //
  // The target is only pulled far enough to put the focus back on the EDGE of
  // the zone, never onto the anchor — otherwise leaving the zone snaps the
  // composition by the full deadzone width and the whole thing reads as a
  // rubber band. Inside the zone the clamp is a no-op and the target does not
  // move by even a pixel, which is the claim this system is making.
  _solveTarget(delta) {
    this._solveFocus(delta);
    this._idealScroll(this._fx, this._fy);
    const z = this.cam.zoom;
    // Deadzone half-extents are viewport pixels; scroll is world pixels.
    const dx = CAMERA.dzX / z, up = CAMERA.dzUp / z, down = CAMERA.dzDown / z;

    // THE SIGN, WRITTEN OUT, BECAUSE IT INVERTS AND IT COST A ROUND.
    // Screen y of the focus is `(focus - scroll) * zoom`, so a HIGHER scroll
    // draws the focus HIGHER on screen. The focus drifting DOWN — toward the
    // controls, the dangerous direction — is therefore the target falling
    // BELOW ideal, and `dzDown` is the allowance on the LOW side.
    this._tx = Phaser.Math.Clamp(this._tx, this._ix - dx, this._ix + dx);
    this._ty = Phaser.Math.Clamp(this._ty, this._iy - down, this._iy + up);
    this._clampTarget();
  }

  // ── MOTION SOLVER ─────────────────────────────────────────────────────────
  //
  // Critically damped spring, implicit Euler. From x'' = -2*w*x' - w^2*(x - T):
  //     v1 = (v0 - h*w^2*(x0 - T)) / (1 + 2*w*h + h^2*w^2)
  //     x1 = x0 + h*v1
  // Unconditionally stable, zero overshoot, and the velocity term is what
  // gives a direction reversal its settle instead of an instant flip.
  _spring(x, v, target, h, w) {
    const f = 1 + 2 * w * h + h * h * w * w;
    const nv = (v - h * w * w * (x - target)) / f;
    this._sv = nv;
    this._sx = x + h * nv;
  }

  _solveMotion(delta) {
    const h = Math.min(delta, 100) / 1000;   // a stalled tab is not a camera move
    // PER AXIS. X is stiffer than Y on purpose — see CAMERA.stiffnessX.
    this._spring(this.cam.scrollX, this._vx, this._tx, h, CAMERA.stiffnessX);
    let x = this._sx; const nvx = this._sv;
    this._spring(this.cam.scrollY, this._vy, this._ty, h, CAMERA.stiffnessY);
    let y = this._sx; const nvy = this._sv;

    // MAXIMUM LAG IS BOUNDED. The spring's steady-state error under a constant
    // velocity V is 2V/w — 56px at a walk, 141px at a 950px/s dash. That is the
    // weight, and it is fine; what is not fine is an unbounded gap if anything
    // ever moves the target faster than a dash. This is a ceiling, not a
    // behaviour: at ordinary speeds it never engages.
    const lag = CAMERA.maxLag / this.cam.zoom;
    x = Phaser.Math.Clamp(x, this._tx - lag, this._tx + lag);
    y = Phaser.Math.Clamp(y, this._ty - lag, this._ty + lag);

    this._vx = nvx; this._vy = nvy;
    // NaN is the one failure that persists: a single bad frame poisons scroll
    // forever, because next frame's spring reads it back. Refuse it here.
    if (Number.isFinite(x) && Number.isFinite(y)) this.cam.setScroll(x, y);
    else this.reset();
  }

  update(delta) {
    if (!this.scene.player) return;
    if (!this._ready) { this.reset(); return; }
    this._solveTarget(delta);
    this._solveMotion(delta);
    if (CAMERA.debug) this._drawDebug();
  }

  // ── DEBUG OVERLAY ─────────────────────────────────────────────────────────
  //
  // Screen-space, scroll factor 0, above everything, and only ever alive while
  // `CAMERA.debug` is on. Camera tuning without this is guessing at which of
  // four numbers produced a feeling.
  _drawDebug() {
    if (!this._dbg) {
      this._dbg = this.scene.add.graphics().setScrollFactor(0).setDepth(99000);
    }
    const g = this._dbg;
    const cw = this.cam.width, ch = this.cam.height, z = this.cam.zoom;
    g.clear();

    // Gameplay-safe area — everything below the line belongs to the controls.
    const sb = this.safeBottom();
    g.lineStyle(2, 0x40ff90, 0.55);
    g.strokeRect(1, 1, cw - 2, sb - 2);

    // Deadzone, around the anchor.
    const ax = CAMERA.anchorX * cw, ay = CAMERA.anchorY * ch;
    g.lineStyle(2, 0xffc040, 0.85);
    g.strokeRect(ax - CAMERA.dzX, ay - CAMERA.dzUp, CAMERA.dzX * 2, CAMERA.dzUp + CAMERA.dzDown);

    // Resting anchor (cross) and the actual camera centre (ring).
    g.lineStyle(2, 0xffc040, 0.9);
    g.lineBetween(ax - 12, ay, ax + 12, ay);
    g.lineBetween(ax, ay - 12, ax, ay + 12);
    g.lineStyle(2, 0x60c0ff, 0.8);
    g.strokeCircle(cw / 2, ch / 2, 9);

    // Desired camera target, drawn where it currently sits on screen. The gap
    // between this and the ring IS the lag.
    const tsx = (this._tx - this.cam.scrollX) * z + cw / 2;
    const tsy = (this._ty - this.cam.scrollY) * z + ch / 2;
    g.lineStyle(2, 0xff5090, 0.9);
    g.strokeCircle(tsx, tsy, 5);

    // THE MOVEMENT LEAD, drawn from the player to the focus the solver is
    // actually composing on. Without this the only visible symptom of a lead
    // that is too large, too small or stuck open is "the camera feels wrong",
    // which is how a camera gets tuned by guessing.
    const p = this.scene.player;
    if (p && (Math.abs(this._leadX) > 0.5 || Math.abs(this._leadY) > 0.5)) {
      const psx = (p.x - this.cam.scrollX) * z;
      const psy = (p.y - this.cam.scrollY) * z;
      g.lineStyle(3, 0x60ffc0, 0.85);
      g.lineBetween(psx, psy, psx + this._leadX * z, psy + this._leadY * z);
      g.fillStyle(0x60ffc0, 0.85);
      g.fillCircle(psx + this._leadX * z, psy + this._leadY * z, 4);
    }
  }

  destroy() {
    this._dbg?.destroy();
    this._dbg = null;
  }
}
