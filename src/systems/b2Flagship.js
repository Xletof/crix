// B2-1 — THE FLAGSHIP EXPERIMENT (`?b2=A|B`, opt-in, HUMAN-authorized
// 2026-11-12; NOT approved, NOT frozen, NOT a default).
//
// ONE automatic rifle, built to be the first record of a reusable weapon
// layer. `installB2(scene)` runs from GameScene.create and does nothing
// without the flag; R1, B0, B1 and every frozen configuration are untouched
// when it is absent (tests/smoke-b2.mjs proves it tick for tick).
//
//   A  the weapon on the R1 Super economy (per hit, pellets self-charge)
//   B  the weapon on the DAMAGE economy: both meters fill from durability the
//      WEAPONS actually removed; the Super's own damage charges nothing
//
// ── WHAT THE WEAPON IS ────────────────────────────────────────────────────
//  FIRE     Press = the stream starts at once; release = it stops. One
//           cadence from the first round to the last (an accumulator, with
//           the round advanced along its path by the part of the frame it
//           was late: spacing does not depend on the frame rate).
//  MAGAZINE 40 rounds in the weapon's own state (`PLAYER.ammoMax` is NOT
//           touched). Empty = an automatic reload; a short pause off the
//           trigger tops it up; casting the Super reloads it instantly.
//  AIM      A dragged stick aims by hand. Otherwise the stream picks its own
//           target: nearest in reach with a clear line, never one that the
//           rounds already in flight will kill (LETHAL BOOKKEEPING), led by
//           the target's motion, and it SWEEPS to the next target instead of
//           teleporting.
//  IMPACT   `Enemy.damage` suspends the AI for 90ms on every hit that carries
//           a knockback vector (frozen). At this cadence that is a permanent
//           lock, so a round passes the vector only once per target per
//           `flinch` ms: the IMPACT BUDGET. Enemy AI itself is not touched.
//  OVERRIDE The rifle pickup would swap this weapon for a weaker one, so
//           under B2 it becomes an OVERCHARGE of it: `hotRounds` rounds at
//           `hot` x damage. The cluster pod is unchanged (press = throw).
//
// ── THE SEAM ──────────────────────────────────────────────────────────────
//  Instance wrappers only, each restored on shutdown if it is still ours:
//  `scene.firePlayerPrimary` (the round), `_cameraPunch` (no per-round punch),
//  `physics.world.pause` (a kill hit-stop BUDGET), the player's `_firePistol`,
//  `releaseAim`, `equipSecondary`, and for B the two charge methods. GameScene
//  itself gains the install and ONE branch at the projectile hit. Rounds are
//  ordinary `playerBullets` (same pool, hitbox, walls, Bulwark fields, Vader).
//  No `Math.random` anywhere in B2 code.
import Phaser from 'phaser';
import { PLAYER } from '../config.js';
import { getB2Variant, getB2Knobs, isB2Range } from './debug.js';
import { SFX, duckMusic } from './FX.js';
import { BulletGroup } from '../entities/Bullet.js';
import { installB2Feel } from './b2Feel.js';
import { createB2Voice } from './b2Voice.js';
import { installB2Range } from './b2Range.js';

/** Starting hypotheses. `&b2x.<key>=<number>` overrides one for a session. */
export const B2_DEFAULTS = {
  // the weapon
  dmg: 65,          // per round (x dmgMult): one round kills a Sector 1-2 Swarmling
  cadence: 100,     // ms between rounds, constant
  mag: 40,          // rounds
  reload: 900,      // ms, automatic (x the player's reloadMult)
  idleReload: 1100, // ms off the trigger before a partial magazine tops up
  speed: 1000,      // px/s
  range: 450,       // px
  // aim
  sweep: 900,       // deg/s the stream turns onto a new target
  snap: 20,         // deg: inside this the round goes straight at the target
  lead: 1,          // 0..1 of first-order target lead
  // impact budget
  flinch: 600,      // ms between knockback (= 90ms AI suspension) hits per target
  stop: 250,        // ms between kill hit-stops caused by the rifle
  // economy (variant B)
  meter: 1000,      // weapon durability removed per Super
  melee: 1600,      // weapon durability removed per Broken Wings chain
  meleeToSuper: 0.5, // Broken Wings damage counts at this weight for the Super
  nemesis: 0.34,    // damage to a nemesis counts at R1's ratio
  // OVERRIDE -> OVERCHARGE
  hot: 1.4,
  hotRounds: 80,
};
const KNOB_MIN = { dmg: 1, cadence: 40, mag: 1, reload: 0, idleReload: 100, speed: 300, range: 100, sweep: 30, snap: 0, lead: 0, flinch: 0, stop: 0, meter: 50, melee: 50, meleeToSuper: 0, nemesis: 0, hot: 1, hotRounds: 0 };

const TAU = Math.PI * 2;
const wrapAng = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
const SRC = ['gun', 'override', 'cluster', 'melee', 'super', 'other'];

export function b2Knobs() {
  const K = { ...B2_DEFAULTS };
  const o = getB2Knobs() || {};
  for (const k of Object.keys(K)) if (typeof o[k] === 'number' && Number.isFinite(o[k])) K[k] = Math.max(KNOB_MIN[k] ?? 0, o[k]);
  return K;
}

export function installB2(scene) {
  const variant = getB2Variant();
  if (!variant || !scene?.player || !scene.events || !scene.playerBullets) return null;
  const game = scene.game;
  const K = b2Knobs();
  const econ = variant === 'B';
  const SUPER_MAX = PLAYER.superHitsToCharge, MELEE_MAX = PLAYER.meleeHitsToCharge;

  // ── state ───────────────────────────────────────────────────────────────
  const w = {
    mag: K.mag, cool: 0, reloadLeft: 0, reloadKind: null, reloadDur: 0, idleT: 0,
    trig: false, pressFired: 0, pressKind: null, pressTouch: null, keyTap: false,
    aimAng: null, target: null, lastShotAt: -1e9, lastFireDir: 0, lastStop: -1e9,
    hot: 0, seq: 0, pendDir: 0, pendLate: 0, pendKind: 'auto', gap: false,
  };
  let clock = 0;
  const rounds = [];                    // live round records
  const tag = new WeakMap();            // bullet -> generation we fired
  const pending = new Map();            // enemy -> damage already in flight
  const flinchAt = new WeakMap();       // enemy -> clock of its last knockback hit
  const hpOf = new WeakMap();           // enemy -> hp after its last hit
  const vel = new WeakMap();            // enemy -> smoothed displacement velocity
  const ctx = { fire: false, src: null };
  const hist = () => ({ bins: new Array(401).fill(0), over: 0, n: 0 });
  const meterStats = () => Object.fromEntries(SRC.map((s) => [s, { events: 0, dmg: 0, requested: 0, added: 0, wasted: 0 }]));
  const stats = {
    variant, knobs: { ...K }, range: isB2Range(),
    shots: 0, presses: 0, taps: 0, pressTouch: 0, pressMouse: 0, pressKey: 0,
    holdMs: 0, holdIntervals: hist(), shotT: [],
    mag: { reloads: { empty: 0, idle: 0, super: 0 }, reloadMs: 0, heldReloadMs: 0, idleCancelled: 0, roundsLost: 0 },
    aim: { manual: 0, auto: 0, blind: 0, retargets: 0, lethalSkips: 0, sweepRounds: 0, outOfReach: 0, noLine: 0, fieldAvoid: 0 },
    impact: { flinch: 0, plain: 0, byType: {} },
    stops: { taken: 0, skipped: 0 },
    hot: { pickups: 0, rounds: 0 },
    charge: { super: meterStats(), melee: meterStats() },
    swallowed: { super: 0, melee: 0 },
    feel: null,
  };
  const api = {
    variant, K, stats, state: w, damageCharge: econ,
    owns: (b) => tag.get(b) === b._gen, firing: null, stickTouch: () => w.pressTouch,
    hit, charge01: () => Phaser.Math.Clamp((scene.player?.superCharge || 0) / SUPER_MAX, 0, 1),
    rounds, clock: () => clock,
  };

  const restores = [];
  const wrap = (obj, name, make) => {
    if (!obj || typeof obj[name] !== 'function') return;
    const had = Object.prototype.hasOwnProperty.call(obj, name);
    const prev = obj[name];
    const mine = make(prev);
    obj[name] = mine;
    restores.push(() => { if (obj[name] === mine) { if (had) obj[name] = prev; else delete obj[name]; } });
  };
  const bound = [];
  const on = (ev, fn) => { scene.events.on(ev, fn); bound.push([ev, fn]); };

  const voice = createB2Voice(K);
  const feel = installB2Feel(scene, api, K, voice);
  stats.feel = feel?.stats || null;

  // ── THE ROUND ───────────────────────────────────────────────────────────
  const baseFire = BulletGroup.prototype.fire;
  function spawnRound(angle) {
    const p = scene.player;
    const late = w.pendLate || 0;
    const reach = PLAYER.radius + 12 + (K.speed * late) / 1000;
    const bx = p.x + Math.cos(angle) * reach, by = p.y + Math.sin(angle) * reach;
    const hot = w.hot > 0;
    if (hot) { w.hot--; stats.hot.rounds++; }
    const dmg = K.dmg * (p.dmgMult || 1) * (hot ? K.hot : 1);
    // The group's own fire, below every presentation wrapper: B2 draws its
    // rounds itself (systems/b2Feel.js).
    const b = baseFire.call(scene.playerBullets, bx, by, angle, K.speed, dmg, K.range, { owner: 'player' });
    if (!b) return;
    b.setVisible(false);
    tag.set(b, b._gen);
    const t = w.pendKind === 'auto' ? w.target : null;
    if (t) pending.set(t, (pending.get(t) || 0) + dmg);
    const rec = { b, gen: b._gen, target: t, dmg, ang: angle, hot, accent: (w.seq & 3) === 3, n: w.seq, heat: api.charge01(), late };
    w.seq++;
    rounds.push(rec);
    feel?.onRound(rec, p);
  }
  wrap(scene, 'firePlayerPrimary', () => (angle) => spawnRound(angle));
  wrap(scene, '_cameraPunch', (prev) => function (...a) { return ctx.fire ? undefined : prev.apply(this, a); });

  function fireRound(dir, late, kind) {
    const p = scene.player;
    w.mag -= 1;
    stats.shots++;
    const eff = clock - late;
    // an interval is 'in-hold' only when nothing but the cadence separated the two rounds
    if (w.pressFired > 0 && !w.gap) {
      const d = Math.round(eff - w.lastShotAt);
      const h = stats.holdIntervals; h.n++;
      if (d >= 0 && d <= 400) h.bins[d]++; else h.over++;
    }
    if (stats.shotT.length < 8000) stats.shotT.push(Math.round(eff));
    w.lastShotAt = eff; w.gap = false;
    w.pressFired++;
    w.lastFireDir = dir;
    w.idleT = 0;
    p.facing = dir; p.aim = dir; p._facingLockMs = 260;
    p.revealTimer = 1500;
    // A light, fast kick on the weapon; no squash and no shove on the body.
    p.recoilT = 0;
    p._wKickT = 46; p._wKickDur = 46; p._wKickMag = (w.seq & 3) === 3 ? 4.2 : 3.1;
    p._fireAnimTimer = 140;
    w.pendDir = dir; w.pendLate = late; w.pendKind = kind;
    ctx.fire = true;
    api.firing = w.trig ? (w.pressKind === 'stick' ? 'hold-stick' : 'hold-key') : 'tap-stick';
    try { scene.events.emit('player-fire', dir); } finally { ctx.fire = false; api.firing = null; }
    voice.shot({ heat: api.charge01(), accent: ((w.seq - 1) & 3) === 3, hot: w.hot > 0, late, n: w.seq - 1, mag: w.mag, magMax: K.mag });
    voice.duck();
    if (w.mag <= 0) startReload('empty');
  }

  // ── THE MAGAZINE ────────────────────────────────────────────────────────
  function startReload(kind) {
    const p = scene.player;
    w.reloadKind = kind; w.gap = true;
    w.reloadDur = Math.max(1, K.reload * (p?.reloadMult || 1) * (kind === 'idle' ? Math.max(0.35, 1 - w.mag / K.mag) : 1));
    w.reloadLeft = w.reloadDur;
    stats.mag.reloads[kind]++;
    voice.reloadStart(w.reloadDur, kind);
    feel?.onReload(kind, w.reloadDur);
  }
  function finishReload(instant = false) {
    w.mag = K.mag; w.reloadLeft = 0; w.reloadKind = null; w.idleT = 0;
    voice.reloadEnd(instant);
    feel?.onReloaded(instant);
  }
  on('player-fire-super', () => {
    if (w.mag < K.mag || w.reloadLeft > 0) { stats.mag.reloads.super++; finishReload(true); }
    feel?.onSuper();
  });

  // ── THE AIM ─────────────────────────────────────────────────────────────
  const losLine = new Phaser.Geom.Line();
  function clearLine(x1, y1, x2, y2) {
    const rects = scene.losRects;
    if (!rects?.length) return true;
    losLine.setTo(x1, y1, x2, y2);
    for (const r of rects) {
      if (x1 >= r.x && x1 <= r.right && y1 >= r.y && y1 <= r.bottom) continue;
      if (x2 >= r.x && x2 <= r.right && y2 >= r.y && y2 <= r.bottom) continue;
      if (Phaser.Geom.Intersects.LineToRectangle(losLine, r)) return false;
    }
    return true;
  }
  const targets = () => {
    const list = scene.enemies?.getChildren?.() || [];
    return scene.boss?.alive ? [...list, scene.boss] : list;
  };
  const live = (e) => e && e.active && e.alive;
  function trackVel(dt) {
    if (dt <= 0) return;
    for (const e of targets()) {
      if (!live(e)) continue;
      let v = vel.get(e);
      if (!v) { vel.set(e, { x: e.x, y: e.y, vx: 0, vy: 0 }); continue; }
      const ix = ((e.x - v.x) / dt) * 1000, iy = ((e.y - v.y) / dt) * 1000;
      v.vx += (ix - v.vx) * 0.3; v.vy += (iy - v.vy) * 0.3;
      v.x = e.x; v.y = e.y;
    }
  }
  function pickTarget(p, streaming) {
    let best = null, bestScore = Infinity, far = null, farD = 700, skipped = 0, blocked = 0, fielded = 0;
    for (const e of targets()) {
      if (!live(e)) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      const reach = K.range + (e.cfg?.radius ?? 22) + 12;
      if (d < farD) { farD = d; far = e; }
      if (d > reach) continue;
      const ang = Math.atan2(e.y - p.y, e.x - p.x);
      // A Bulwark showing its field would only eat the rounds: last choice.
      const field = !!(e._blocksFrontal && e.isFrontalHit?.(ang));
      if (!field && e !== scene.boss && (pending.get(e) || 0) >= e.hp) { skipped++; continue; }
      let score = d + (field ? 260 : 0);
      if (field) fielded++;
      if (!clearLine(p.x, p.y, e.x, e.y)) { score += 500; blocked++; }
      if (streaming && w.aimAng != null) score += Math.abs(wrapAng(ang - w.aimAng)) * 70;
      if (e === w.target) score -= 80;
      if (score < bestScore) { bestScore = score; best = e; }
    }
    if (skipped && best) stats.aim.lethalSkips++;
    // Everything in reach is already dead in flight: stay on the nearest of
    // them rather than swinging away to something the rounds cannot reach.
    if (!best && skipped) {
      let d0 = Infinity;
      for (const e of targets()) { if (!live(e)) continue; const d = Math.hypot(e.x - p.x, e.y - p.y); if (d <= K.range + 40 && d < d0) { d0 = d; best = e; } }
    }
    if (best && bestScore >= 500) stats.aim.noLine++;
    if (best && fielded && !(best._blocksFrontal)) stats.aim.fieldAvoid++;
    return { t: best, far };
  }
  function aimAt(p, e) {
    let tx = e.x, ty = e.y;
    const v = vel.get(e);
    if (v && K.lead > 0) {
      const d = Math.hypot(tx - p.x, ty - p.y);
      const tt = (d / K.speed) * K.lead;
      let lx = v.vx * tt, ly = v.vy * tt;
      const m = Math.hypot(lx, ly);
      if (m > 70) { lx *= 70 / m; ly *= 70 / m; }
      tx += lx; ty += ly;
    }
    return Math.atan2(ty - p.y, tx - p.x);
  }
  /** The direction the next round leaves along, and why. */
  function resolveDir(p, vec, snapNow) {
    if (vec && vec.force > 0.05) {
      w.target = null; w.aimAng = Math.atan2(vec.y, vec.x);
      return { dir: w.aimAng, kind: 'manual' };
    }
    const streaming = w.pressFired > 0;
    const prev = w.target;
    const { t, far } = pickTarget(p, streaming);
    if (t) {
      if (prev && t !== prev && streaming) stats.aim.retargets++;
      w.target = t;
      const want = aimAt(p, t);
      if (w.aimAng == null || snapNow || !streaming) w.aimAng = want;
      const err = wrapAng(want - w.aimAng);
      if (Math.abs(err) <= Phaser.Math.DegToRad(K.snap)) { w.aimAng = want; return { dir: want, kind: 'auto' }; }
      stats.aim.sweepRounds++;
      return { dir: w.aimAng, kind: 'sweep' };
    }
    w.target = null;
    if (far) { stats.aim.outOfReach++; w.aimAng = Math.atan2(far.y - p.y, far.x - p.x); return { dir: w.aimAng, kind: 'far' }; }
    w.aimAng = p.facing;
    return { dir: p.facing, kind: 'blind' };
  }
  function slew(p, dt) {
    const t = w.target;
    if (!live(t) || w.aimAng == null) return;
    const err = wrapAng(aimAt(p, t) - w.aimAng);
    const step = Phaser.Math.DegToRad(K.sweep) * dt / 1000;
    w.aimAng = wrapAng(w.aimAng + Phaser.Math.Clamp(err, -step, step));
  }
  const countAim = (kind) => {
    if (kind === 'manual') stats.aim.manual++; else if (kind === 'blind' || kind === 'far') stats.aim.blind++; else stats.aim.auto++;
  };

  // ── THE TRIGGER ─────────────────────────────────────────────────────────
  const hudOf = () => game.scene.getScene('HUD');
  const blocked = (hud) => !!(hud?.hackMinigame && hud.hackMinigame.state !== 'idle');
  const secondaryUp = (p) => !!(p.secondary && p.secondaryAmmo > 0);
  /** One round now, if the weapon can: the tap path and the first round of a press. */
  function tryRound(vec, kind) {
    const p = scene.player;
    if (!p?.alive || secondaryUp(p)) return false;
    if (w.reloadLeft > 0 && w.reloadKind === 'idle' && w.mag > 0) { w.reloadLeft = 0; w.reloadKind = null; stats.mag.idleCancelled++; voice.reloadCancel(); feel?.onReloaded(false, true); }
    if (w.cool > 0 || w.mag <= 0 || w.reloadLeft > 0) return false;
    const r = resolveDir(p, vec, true);
    countAim(r.kind);
    fireRound(r.dir, 0, r.kind === 'auto' ? 'auto' : r.kind);
    w.cool = K.cadence;
    return true;
  }
  const p0 = scene.player;
  // Every R1 path into the pistol (a keyboard tap, a stick release with no
  // secondary, a test calling `tryFire`) fires one round of THIS weapon.
  wrap(p0, '_firePistol', () => function (dir) { return tryRound({ x: Math.cos(dir), y: Math.sin(dir), force: 1 }, 'tap'); });
  wrap(p0, 'releaseAim', (prev) => function (vec) {
    if (!this.alive) return undefined;
    if (secondaryUp(this)) return prev.call(this, vec);   // the cluster pod: release = throw, as R1
    if (w.pressFired === 0 && !blocked(hudOf())) { if (tryRound(vec, 'tap')) stats.taps++; }
    this.aiming = false;
    return undefined;
  });
  // OVERRIDE -> OVERCHARGE: the pickup strengthens this weapon instead of
  // replacing it with a weaker one.
  wrap(p0, 'equipSecondary', (prev) => function (id) {
    if (id !== 'rifle') return prev.call(this, id);
    w.hot += K.hotRounds; stats.hot.pickups++;
    SFX.waveStart?.();
    scene.events.emit('show-banner', `OVERCHARGE: ${K.hotRounds} HOT ROUNDS`, '#ffb020');
    feel?.onOvercharge();
    return undefined;
  });

  // Desktop: SPACE is the trigger and nothing else. The Super keeps F / ENTER
  // (and the on-screen button), so holding fire never depends on the meter.
  const kb = scene.input?.keyboard;
  if (kb) {
    for (const ev of ['keydown-SPACE', 'keyup-SPACE', 'keydown-F', 'keydown-ENTER']) kb.removeAllListeners(ev);
    scene._spaceDownAt = 0;
    kb.on('keydown-SPACE', (ev) => {
      if (ev?.repeat) return;
      const p = scene.player;
      if (!p?.alive) return;
      if (secondaryUp(p)) { p.keyboardFire(); return; }
      w.keyTap = true;                          // a press shorter than a frame still fires
    });
    const castSuper = () => {
      const p = scene.player;
      if (!p?.alive) return;
      p.tryFireSuper(w.trig && w.aimAng != null ? w.aimAng : p._autoAimAngle());
    };
    kb.on('keydown-F', (ev) => { if (!ev?.repeat) castSuper(); });
    kb.on('keydown-ENTER', (ev) => { if (!ev?.repeat) castSuper(); });
  }

  function tickTrigger(dt) {
    const p = scene.player;
    const hud = hudOf();
    const fs = hud?.fireStick;
    const stick = !!fs?.active && !blocked(hud);
    const key = !!scene.cursors?.space?.isDown || w.keyTap;
    const sec = secondaryUp(p);
    const trig = (stick || key) && !sec;
    if (trig && !w.trig) {
      w.pressFired = 0; stats.presses++;
      w.pressKind = stick ? 'stick' : 'key';
      if (stick) {
        const ptr = hud.input?.manager?.pointers?.find?.((q) => q.id === fs.pointerId);
        w.pressTouch = ptr ? !!ptr.wasTouch : null;
        if (w.pressTouch === true) stats.pressTouch++; else if (w.pressTouch === false) stats.pressMouse++;
      } else { w.pressTouch = null; stats.pressKey++; }
    } else if (!trig && w.trig) {
      if (w.pressFired === 1) stats.taps++;
      if (w.pressFired >= 3) voice.tail(api.charge01());
      feel?.onRelease(w.pressFired);
      w.pressFired = 0;
    }
    w.trig = trig;
    const was = w.cool;
    w.cool -= dt;
    if (w.reloadLeft > 0) {
      if (trig) stats.mag.heldReloadMs += Math.min(dt, w.reloadLeft);
      stats.mag.reloadMs += Math.min(dt, w.reloadLeft);
      w.reloadLeft -= dt;
      if (w.reloadLeft <= 0) finishReload(false);
    }
    if (trig) {
      stats.holdMs += dt;
      const vec = stick ? fs.vec : null;
      if (w.reloadLeft > 0 && w.reloadKind === 'idle' && w.mag > 0) { w.reloadLeft = 0; w.reloadKind = null; stats.mag.idleCancelled++; voice.reloadCancel(); feel?.onReloaded(false, true); }
      if (!(vec && vec.force > 0.05)) slew(p, dt);
      let n = 0;
      while (w.cool <= 0 && w.mag > 0 && w.reloadLeft <= 0 && n < 2) {
        const late = was > 0 ? Math.min(dt, -w.cool) : 0;
        const r = resolveDir(p, vec, w.pressFired === 0);
        countAim(r.kind);
        fireRound(r.dir, n === 0 ? late : 0, r.kind === 'auto' ? 'auto' : r.kind);
        w.cool = (was > 0 ? w.cool : 0) + K.cadence;
        n++;
      }
    } else if (!sec && w.mag < K.mag && w.reloadLeft <= 0) {
      w.idleT += dt;
      if (w.idleT >= K.idleReload) startReload('idle');
    }
    if (w.cool < 0) w.cool = 0;
    w.keyTap = false;
  }

  // ── THE IMPACT BUDGET (the one GameScene branch calls this) ─────────────
  function hit(e, b, kbVec) {
    const last = flinchAt.get(e);
    const typ = `${e.enemyType || 'enemy'}${e._elite ? '*' : ''}${e._miniBoss ? '!' : ''}`;
    const bt = stats.impact.byType[typ] || (stats.impact.byType[typ] = { flinch: 0, plain: 0 });
    if (last == null || clock - last >= K.flinch) {
      flinchAt.set(e, clock);
      stats.impact.flinch++; bt.flinch++;
      feel?.onContact(e, b, true);
      try { e.damage(b.damage, kbVec); } finally { feel?.afterContact(); }
    } else {
      stats.impact.plain++; bt.plain++;
      feel?.onContact(e, b, false);
      try { e.damage(b.damage, null); } finally { feel?.afterContact(); }
    }
  }
  // A kill hit-stop is a punctuation mark; a stream of kills gets one per
  // `stop` ms, not one per kill frame.
  wrap(scene.physics?.world, 'pause', (prev) => function (...a) {
    if (scene._dmgSrc === 'primary' && scene.player?.alive) {
      if (clock - w.lastStop < K.stop) { stats.stops.skipped++; return this; }
      w.lastStop = clock; stats.stops.taken++;
    }
    return prev.apply(this, a);
  });

  // ── THE ECONOMY (variant B) ─────────────────────────────────────────────
  const srcNow = () => {
    if (ctx.src) return ctx.src;
    const d = scene._dmgSrc;
    if (d === 'primary') return 'gun';
    if (d === 'secondary') return scene._shotSrc === 'override' ? 'override' : 'cluster';
    if (d === 'super') return 'super';
    if (d === 'melee') return 'melee';
    return 'other';
  };
  const W_SUPER = { gun: 1, override: 1, cluster: 1, melee: K.meleeToSuper, super: 0, other: 0 };
  const W_MELEE = { gun: 1, override: 1, cluster: 1, melee: 0, super: 0, other: 0 };
  function credit(meter, src, dmg, units) {
    const p = scene.player;
    const c = stats.charge[meter][src];
    c.events++; c.dmg += dmg; c.requested += units;
    if (units <= 0) return;
    if (meter === 'super') {
      const before = p.superCharge;
      p.superCharge = Math.min(SUPER_MAX, before + units);
      const add = p.superCharge - before;
      c.added += add; c.wasted += units - add;
      if (before < SUPER_MAX && p.superCharge >= SUPER_MAX) { SFX.superReady?.(); scene.events.emit('player-super-ready'); }
      else if (add > 0) scene.events.emit('player-super-changed');
    } else {
      const before = p.meleeCharge;
      p.meleeCharge = Math.min(MELEE_MAX, before + units);
      const add = p.meleeCharge - before;
      c.added += add; c.wasted += units - add;
      if (before < MELEE_MAX && p.meleeCharge >= MELEE_MAX) scene.events.emit('player-melee-ready');
      else if (add > 0) scene.events.emit('player-melee-changed');
    }
  }
  on('enemy-hit', (e, amount, feedback) => {
    const before = hpOf.has(e) ? hpOf.get(e) : (e.hpMax ?? amount);
    let removed = (feedback && typeof feedback.shown === 'number') ? feedback.shown
      : (e.hp > 0 ? amount : Math.min(amount, before));
    removed = Math.max(0, removed || 0);
    hpOf.set(e, e.hp ?? 0);
    if (!econ || removed <= 0) return;
    const p = scene.player;
    if (!p?.alive) return;
    const src = srcNow();
    const scale = (e._miniBoss ? K.nemesis : 1) * (p.superGainMult || 1);
    credit('super', src, removed, (removed * W_SUPER[src] * scale / K.meter) * SUPER_MAX);
    credit('melee', src, removed, (removed * W_MELEE[src] * scale / K.melee) * MELEE_MAX);
  });
  if (econ) {
    // The per-hit rule is replaced whole: its calls (projectile hits, a landed
    // Broken Wings cast, cluster and grenade blasts) add nothing.
    wrap(p0, 'addSuperHit', () => function () { stats.swallowed.super++; });
    wrap(p0, 'addMeleeHit', () => function () { stats.swallowed.melee++; });
  }
  // Cluster and grenade blasts damage outside the projectile sweep: name them.
  wrap(scene, '_clusterImpact', (prev) => function (...a) { const s = ctx.src; ctx.src = 'cluster'; try { return prev.apply(this, a); } finally { ctx.src = s; } });
  wrap(scene, 'detonateGrenade', (prev) => function (...a) { const s = ctx.src; ctx.src = 'other'; try { return prev.apply(this, a); } finally { ctx.src = s; } });
  // The gun is the meter: its own rising voice replaces the per-hit blip, in
  // both variants, so A and B differ in economy and in nothing else.
  wrap(SFX, 'superTick', () => () => {});
  wrap(SFX, 'superHalf', () => () => {});
  on('player-super-ready', () => feel?.onPrimed());

  // ── THE FRAME ───────────────────────────────────────────────────────────
  function sweepRounds() {
    for (let i = rounds.length - 1; i >= 0; i--) {
      const r = rounds[i], b = r.b;
      if (b.active && b._gen === r.gen) continue;
      if (r.target) {
        const left = (pending.get(r.target) || 0) - r.dmg;
        if (left > 0.5) pending.set(r.target, left); else pending.delete(r.target);
      }
      feel?.onRoundEnd(r);
      rounds.splice(i, 1);
    }
    if (pending.size > 64) for (const e of pending.keys()) if (!live(e)) pending.delete(e);
  }
  const onPost = (time, delta) => {
    const dt = typeof delta === 'number' && delta > 0 ? delta : 0;
    clock += dt;
    const p = scene.player;
    sweepRounds();
    trackVel(dt);
    if (p?.alive) tickTrigger(dt);
    else {
      if (w.trig) { w.trig = false; w.pressFired = 0; feel?.onRelease(0); }
      w.mag = K.mag; w.reloadLeft = 0; w.reloadKind = null; w.cool = 0; w.target = null; w.aimAng = null; w.keyTap = false;
    }
    feel?.update(dt, clock);
  };
  scene.events.on('postupdate', onPost);

  const range = isB2Range() ? installB2Range(scene, api, wrap) : null;
  api.range = range;

  const teardown = () => {
    scene.events.off('postupdate', onPost);
    bound.splice(0).forEach(([ev, fn]) => scene.events.off(ev, fn));
    restores.splice(0).reverse().forEach((f) => { try { f(); } catch (_) { /* */ } });
    try { range?.destroy(); } catch (_) { /* */ }
    try { feel?.destroy(); } catch (_) { /* */ }
    try { voice.destroy(); } catch (_) { /* */ }
    rounds.length = 0; pending.clear();
    if (scene._b2 === api) scene._b2 = null;
  };
  scene.events.once('shutdown', teardown);
  scene.events.once('destroy', teardown);
  scene._b2 = api;
  return api;
}
