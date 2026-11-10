// ── B1 — COMBAT EXPERIMENT VARIANTS (`?b1=G|M|S`) — OPT-IN, HUMAN-AUTHORIZED ──
//
// HUMAN brief (2026-11-10): three isolated variants for playtesting, NOT a
// permanent change and NOT a default. With the flag absent nothing here runs:
// no tuning is touched, nothing is installed, the game is R1 tick for tick
// (`tests/smoke-b1.mjs`).
//
// ALL THREE share one STANDARD rifle: a 10-round magazine, a 110ms fire
// cooldown, 260ms sequential ammo regeneration, hold-to-fire with single-shot
// tapping preserved, base damage 120 (unchanged).
//
//   G  gun only — the STANDARD above; Super, charge, knockback = R1
//   M  + Super 300 dmg/pellet, ~90px push, 25% movement slow for 1.5s
//   S  + Super 150 dmg/pellet, ~180px push, 40% movement slow for 2s
//
// The changed Super applies to ORDINARY enemies only (Regulars, Elites and
// Bulwarks). A nemesis (`_miniBoss`), a Champion (the Shock Captain), Vader
// and his VANISH afterimages keep the R1 Super exactly. The five-pellet
// discharge, piercing, chaining and self-recharge are untouched (charge is
// added by GameScene after the damage call, as in R1). No damage-vulnerability
// multiplier is added: the push sets `_staggerMs` / `_shoveMs` directly and
// never calls `stagger()`, which would open a punish window.
//
// NO NEW RANDOMNESS. Nothing here calls Math.random; every decision is a pure
// function of game state.
import { PLAYER } from '../config.js';
import { getB1Variant } from './debug.js';

export const B1_STANDARD = { ammoMax: 10, fireCooldownMs: 110, ammoReloadMs: 260 };
// A press shorter than this is a TAP: one shot on release, exactly as R1. Held
// past it, STANDARD repeats at its cooldown while the stick / SPACE stays down.
export const B1_HOLD_ARM_MS = 160;
export const B1_SUPER = {
  M: { pelletDamage: 300, pushPx: 90, pushMs: 150, slow: 0.25, slowMs: 1500 },
  S: { pelletDamage: 150, pushPx: 180, pushMs: 200, slow: 0.40, slowMs: 2000 },
};
// NO PERMANENT LOCKS. Pushes suspend the AI for the push only (150 / 200ms).
// After a push ends the enemy cannot be pushed again for this long, so even
// Supers chained every 240ms (the B0 minimum) leave the AI running at least
// 600 / (600 + 200) = 75% of the time. The slow refreshes but never stacks:
// a slowed enemy still moves at 60-75% speed.
export const B1_PUSH_IMMUNE_MS = 600;

/**
 * Set the shared STANDARD tuning. Called ONCE from BootScene, and only when
 * `?b1=` names a variant. PLAYER is the registry every reader already uses
 * (Player fire / reload, the HUD's pips and reload bar, the respawn refill),
 * so one write keeps them all consistent. A reload restores R1.
 */
export function applyB1Tuning() {
  if (!getB1Variant()) return;
  PLAYER.ammoMax = B1_STANDARD.ammoMax;
  PLAYER.fireCooldownMs = B1_STANDARD.fireCooldownMs;
  PLAYER.ammoReloadMs = B1_STANDARD.ammoReloadMs;
}

/** Install on a freshly created GameScene. Only called when a variant is set. */
export function installB1(scene) {
  const variant = getB1Variant();
  if (!variant) return null;
  const SUP = B1_SUPER[variant] || null;
  const game = scene.game;

  const stats = {
    variant,
    standard: { ...B1_STANDARD, holdArmMs: B1_HOLD_ARM_MS },
    super: SUP ? { ...SUP, immuneMs: B1_PUSH_IMMUNE_MS } : null,
    hold: { stickPresses: 0, stickHoldShots: 0, keyHoldShots: 0, releaseShotsSuppressed: 0, heldEmptyMs: 0, stickTouchPresses: 0, stickMousePresses: 0 },
    superHits: 0, superHitsKilled: 0, dedupSkipped: 0,
    pushes: 0, pushImmune: 0, pushSkippedBusy: 0, pushDist: [], pushEndedEarly: 0,
    slowApplied: 0, slowRefreshed: 0, slowedMs: 0, slowRestored: 0,
    byType: {},
  };
  const typeKey = (e) => `${e.enemyType || 'unknown'}${e._elite ? '*' : ''}`;
  const bump = (e, k, v = 1) => { const t = stats.byType[typeKey(e)] || (stats.byType[typeKey(e)] = { pushes: 0, pushPx: 0, slowedMs: 0, superHits: 0 }); t[k] += v; };

  let clock = 0;                   // loop-ms, advanced on postupdate
  let castSeq = 0;
  const castOf = new WeakMap();    // super pellet -> { gen, cast }
  const appliedCast = new WeakMap(); // enemy -> last cast applied
  const pushes = new Map();        // enemy -> { vx, vy, left, x0, y0 }
  const immuneUntil = new WeakMap(); // enemy -> clock ms
  const slows = new Map();         // enemy -> { base, slowed, left }

  const bound = [];
  const on = (ev, fn) => { bound.push([ev, fn]); scene.events.on(ev, fn); };

  // ── WHICH CAST A PELLET BELONGS TO ──────────────────────────────────────
  // `_superBlast` fires the five pellets and then emits this synchronously, so
  // the pellets whose fire generation changed since we last looked are this
  // cast's. Exact even when pellets from an earlier cast are still in flight.
  on('player-super-blast', () => {
    castSeq++;
    for (const b of scene.playerSuperBullets?.getChildren?.() || []) {
      if (!b.active) continue;
      const t = castOf.get(b);
      if (!t || t.gen !== b._gen) castOf.set(b, { gen: b._gen, cast: castSeq });
    }
  });

  // ── THE SUPER ON AN ORDINARY ENEMY ──────────────────────────────────────
  function superApplies(e) {
    return !!SUP && !!e && e.alive && !e._miniBoss && !e.isChampion && !e._afterimage && e !== scene.boss;
  }

  function startSlow(e) {
    const rec = slows.get(e);
    if (rec) { rec.left = SUP.slowMs; stats.slowRefreshed++; return; }
    const base = e.cfg;
    const slowed = { ...base, speed: base.speed * (1 - SUP.slow) };
    e.cfg = slowed;
    slows.set(e, { base, slowed, left: SUP.slowMs });
    stats.slowApplied++;
  }

  function startPush(e, angle) {
    if (pushes.has(e)) { stats.pushSkippedBusy++; return; }
    if ((immuneUntil.get(e) ?? -1) > clock) { stats.pushImmune++; return; }
    // Something else already owns this body's motion (the Demolisher's own
    // throw-clear, or a longer stagger such as Broken Wings' slam stun).
    if ((e._shoveMs || 0) > 0 || (e._staggerMs || 0) > SUP.pushMs || e._performing) { stats.pushSkippedBusy++; return; }
    // DISTANCE-CONTROLLED: the push runs at pushPx / pushMs until the enemy
    // has actually travelled ~pushPx (so 90 / 180px at any frame rate), with a
    // time cap for a body stopped by a wall.
    const v = SUP.pushPx / (SUP.pushMs / 1000);
    const vx = Math.cos(angle) * v, vy = Math.sin(angle) * v;
    e._staggerMs = Math.max(e._staggerMs || 0, SUP.pushMs);   // AI suspended for the push only
    e._shoveMs = Math.max(e._shoveMs || 0, SUP.pushMs);       // exempt from the stagger velocity decay
    e.body?.setVelocity(vx, vy);
    pushes.set(e, { vx, vy, v, left: SUP.pushMs * 1.5, x0: e.x, y0: e.y });
    stats.pushes++; bump(e, 'pushes');
  }

  /**
   * Replaces `e.damage(b.damage, kbVec)` for a Super pellet on an ordinary
   * enemy (GameScene.handleBulletEnemyHits). The tags GameScene set around the
   * call (`_dmgSrc`, `_superHitCtx`) are still in force, so attribution and the
   * hit feedback are unchanged.
   */
  function superHit(e, b, kbVec) {
    const amount = b.damage * (SUP.pelletDamage / PLAYER.superDamage);
    e.damage(amount, null);
    stats.superHits++; bump(e, 'superHits');
    if (!e.alive) {
      // The corpse slides exactly as in R1: Enemy.damage adds the knockback
      // to the velocity and die() only sets drag, so adding it after the death
      // yields the same motion.
      if (kbVec && e.body) e.body.setVelocity(e.body.velocity.x + kbVec.x, e.body.velocity.y + kbVec.y);
      stats.superHitsKilled++;
      return;
    }
    // ONE push and ONE slow per enemy per cast, however many pellets cross it.
    const t = castOf.get(b);
    const cast = t && t.gen === b._gen ? t.cast : b;
    if (appliedCast.get(e) === cast) { stats.dedupSkipped++; return; }
    appliedCast.set(e, cast);
    startSlow(e);
    startPush(e, Math.atan2(b.body.velocity.y, b.body.velocity.x));
  }

  // ── HOLD-TO-FIRE (STANDARD only) ────────────────────────────────────────
  const hold = { stickDown: false, stickT: 0, stickFired: 0, keyDown: false, keyT: 0, stickTouch: null };
  const api = { variant, stats, superApplies, superHit, firing: null, stickTouch: () => hold.stickTouch };
  const wrapped = new WeakSet();
  const restores = [];
  function wrapPlayer(p) {
    if (!p || wrapped.has(p)) return;
    wrapped.add(p);
    const orig = p.releaseAim;
    // A hold that already auto-fired does not add one more shot on release; a
    // tap (no auto-fire) releases exactly as R1.
    p.releaseAim = function (vec) {
      if (hold.stickFired > 0) {
        hold.stickFired = 0;
        stats.hold.releaseShotsSuppressed++;
        this.aiming = false;
        return undefined;
      }
      return orig.call(this, vec);
    };
    restores.push(() => { if (p.releaseAim !== orig) delete p.releaseAim; });
  }
  const canAuto = (p, hud) => p?.alive && !(p.secondary && p.secondaryAmmo > 0)
    && !(hud?.hackMinigame && hud.hackMinigame.state !== 'idle');
  const tryAuto = (p, angle, kind) => {
    if (p.fireCooldown > 0) return false;
    if (p.ammo <= 0) return false;
    api.firing = kind;
    let ok = false;
    try { ok = p.tryFire(angle); } finally { api.firing = null; }
    return ok;
  };

  function tickHold(dt) {
    const p = scene.player;
    if (!p) return;
    wrapPlayer(p);
    const hud = game.scene.getScene('HUD');
    const fs = hud?.fireStick;
    if (fs?.active) {
      if (!hold.stickDown) {
        hold.stickDown = true; hold.stickT = 0; hold.stickFired = 0;
        const ptr = hud.input?.manager?.pointers?.find?.((q) => q.id === fs.pointerId);
        hold.stickTouch = ptr ? !!ptr.wasTouch : null;
        stats.hold.stickPresses++;
        if (hold.stickTouch === true) stats.hold.stickTouchPresses++; else if (hold.stickTouch === false) stats.hold.stickMousePresses++;
      } else hold.stickT += dt;
      if (hold.stickT >= B1_HOLD_ARM_MS && canAuto(p, hud)) {
        if (p.ammo <= 0) stats.hold.heldEmptyMs += dt;
        const v = fs.vec;
        const angle = v && v.force > 0 ? Math.atan2(v.y, v.x) : p._autoAimAngle();
        if (tryAuto(p, angle, 'hold-stick')) { hold.stickFired++; stats.hold.stickHoldShots++; }
      }
    } else if (hold.stickDown) {
      hold.stickDown = false;
    }
    const sp = scene.cursors?.space;
    if (sp?.isDown && !scene._spaceDownAt) {
      if (!hold.keyDown) { hold.keyDown = true; hold.keyT = 0; } else hold.keyT += dt;
      if (hold.keyT >= B1_HOLD_ARM_MS && canAuto(p, hud)) {
        if (p.ammo <= 0) stats.hold.heldEmptyMs += dt;
        if (tryAuto(p, p._autoAimAngle(), 'hold-key')) stats.hold.keyHoldShots++;
      }
    } else hold.keyDown = false;
  }

  // ── PUSH AND SLOW UPKEEP ────────────────────────────────────────────────
  function tickEffects(dt) {
    for (const [e, r] of pushes) {
      if (!e.active || !e.alive || !e.body) { pushes.delete(e); stats.pushEndedEarly++; continue; }
      r.left -= dt;
      const d = Math.hypot(e.x - r.x0, e.y - r.y0);
      // Stop once the next half step would pass the target distance.
      if (r.left > 0 && d < SUP.pushPx - (r.v * dt) / 2000) {
        // One author for the velocity while the push runs: keep the AI
        // suspended and the decay off for exactly one more frame.
        e._staggerMs = Math.max(e._staggerMs || 0, dt + 1);
        e._shoveMs = Math.max(e._shoveMs || 0, dt + 1);
        e.body.setVelocity(r.vx, r.vy);
        continue;
      }
      // The push is over. Unless a longer effect (Broken Wings' slam stun, the
      // Demolisher's throw-clear) now owns the body, stop it and hand the AI
      // back on the next frame: no residual velocity, no extra suspension.
      if ((e._staggerMs || 0) <= dt + 1 && (e._shoveMs || 0) <= dt + 1) {
        e.body.setVelocity(0, 0);
        e._staggerMs = 0; e._shoveMs = 0;
      }
      if (stats.pushDist.length < 4000) stats.pushDist.push(Math.round(d));
      bump(e, 'pushPx', d);
      immuneUntil.set(e, clock + B1_PUSH_IMMUNE_MS);
      pushes.delete(e);
    }
    for (const [e, r] of slows) {
      if (!e.active || !e.alive) { slows.delete(e); continue; }
      const step = Math.min(dt, r.left);
      r.left -= dt;
      stats.slowedMs += step; bump(e, 'slowedMs', step);
      if (r.left <= 0) {
        if (e.cfg === r.slowed) { e.cfg = r.base; stats.slowRestored++; }
        slows.delete(e);
      }
    }
  }

  // The frame delta the scene itself was stepped with (the same value every
  // sprite's preUpdate, and so the stagger countdown, received).
  const onPost = (time, delta) => {
    const dt = (typeof delta === 'number' ? delta : game.loop.delta) || 0;
    clock += dt;
    tickHold(dt);
    if (SUP) tickEffects(dt);
  };
  scene.events.on('postupdate', onPost);

  // ── THE HUD: TEN PIPS HAVE TO FIT ───────────────────────────────────────
  // The shipped layout spaces pips 28px apart, centred over the aim stick:
  // ten would run 252px and off the right edge. Same pips, same drawing,
  // packed to 15px at 0.8 scale (145px). Instance wrapper, restored on exit.
  const hudRestore = [];
  function fitPips(hud) {
    if (!hud?.ammoPips || hud._b1Fit) return;
    hud._b1Fit = true;
    const orig = hud._layoutChrome;
    const fit = () => {
      const pips = hud.ammoPips; const n = pips.length;
      if (n <= 3) return;
      const cx = pips.reduce((s, g) => s + g.x, 0) / n;
      for (let i = 0; i < n; i++) { pips[i].x = cx + (i - (n - 1) / 2) * 15; pips[i].setScale(0.8); }
    };
    hud._layoutChrome = function (...a) { const r = orig.apply(this, a); fit(); return r; };
    fit();
    hudRestore.push(() => { delete hud._layoutChrome; delete hud._b1Fit; });
  }
  const hudScene = game.scene.getScene('HUD');
  const onHudCreate = () => fitPips(game.scene.getScene('HUD'));
  if (hudScene?.ammoPips && hudScene.sys.isActive()) fitPips(hudScene);
  hudScene?.events?.on('create', onHudCreate);

  const teardown = () => {
    scene.events.off('postupdate', onPost);
    bound.forEach(([ev, fn]) => scene.events.off(ev, fn));
    bound.length = 0;
    hudScene?.events?.off('create', onHudCreate);
    restores.splice(0).forEach((f) => { try { f(); } catch (_) { /* */ } });
    hudRestore.splice(0).forEach((f) => { try { f(); } catch (_) { /* */ } });
    for (const [e, r] of slows) if (e.cfg === r.slowed) e.cfg = r.base;
    slows.clear(); pushes.clear();
    if (scene._b1 === api) scene._b1 = null;
  };
  scene.events.once('shutdown', teardown);
  scene.events.once('destroy', teardown);
  scene._b1 = api;
  return api;
}
