// Nemesis moves — attacks with a body behind them.
//
// ── What was wrong with the first version of this file ────────────────────
//
// It defined `telegraph()` and `resolve()`. That is: draw a circle, wait 800ms,
// deal damage. The enemy stood perfectly still through all of it. Four moves
// built that way are four different circles, and the verdict was exact — "some
// new circle attacks which don't have animation or connection".
//
// Nothing about a ground decal tells you an ENEMY is about to do something. You
// end up reading the floor instead of the fight, and since there was no recovery
// afterwards, dodging earned nothing: the optimal play was to ignore the circle
// and keep shooting. Hence "they didn't make me move differently" — mechanically
// true, because nothing about them rewarded moving.
//
// ── What these are instead ────────────────────────────────────────────────
//
// Every move here is a `runMove` script with all four beats — ANTICIPATE, ACT,
// IMPACT, RECOVER — and `MoveScript.runMove` throws if ACT is missing, so the
// old shape cannot come back by accident. ACT is where the enemy physically
// travels, spins or vanishes; RECOVER is a real stagger where it takes bonus
// damage, so beating a move pays.
//
// The five are chosen so no single habit answers them all:
//
//   CHARGE      answered by stepping OFF the lane        (Hades, Asterius)
//   BLINK-DASH  answered by tracking where it WENT       (Hollow Knight)
//   BAIT SLAM   answered by NOT dodging early            (Dark Souls)
//   SPIRAL      answered by weaving, not fleeing         (Enter the Gungeon)
//   RITE        answered by SHOOTING, not dodging        (interruptible channel)
//
// The last one matters most for variety: it is the only move whose correct
// answer is offence. If every move is "get out of the way", the fight has one
// verb no matter how many moves it has.

import Phaser from 'phaser';
import { DASH_REACH } from '../systems/Telegraph.js';
import {
  squash, rearBack, leapArc, charge, spin, vanish, appear,
  raiseWeapon, dropWeapon, stagger,
} from '../systems/actorMotion.js';
import { SFX } from '../systems/FX.js';

// Windup floor. ~250ms is raw human reaction; the rest is thumb travel plus the
// fact that the player is usually mid-decision about something else.
const WINDUP = 800;

// Damage that must land inside RITE's channel to break it. Flat, not a
// fraction of the caster's hp — see the interrupt check in `rite`. Exported so
// the test and the design share one number, as with FAIRNESS_REACH below.
export const RITE_BREAK_DAMAGE = 1500;

// MINEFIELD: how far the retreat may bend toward the arena centre to avoid
// backing into a wall, and the minimum gap between two mines.
// How hard a committed dash throws the player on contact.
const KNOCKBACK = 620;

const MINE_BEND = 0.9;
const MINE_SPACING = 96;
const MINE_MARGIN = 140;

/** Keep a laid mine on the floor rather than inside a wall. */
const clampAxis = (v, extent) =>
  Math.max(MINE_EDGE, Math.min(extent - MINE_EDGE, v));
const MINE_EDGE = 90;

// ── Colour ────────────────────────────────────────────────────────────────
//
// Every effect below takes a tint from the caster's LEADING trait, so the same
// attack reads as the same attack while an ARMORED and a VOLATILE nemesis doing
// it look like different creatures. The move keeps its identity, the enemy
// keeps its character, and neither is borrowed from Vader or from the player.
//
// Falls back to the move's own colour for anything without a trait — a plain
// elite, or the debug spawner.
// Read off `nem.tint`, which `rollNemesis` already sets to the leading trait's
// colour (`nemesis.js`: `n.tint = wanted[0]?.color`). Importing `traitById`
// here to re-derive it would close an import cycle — `nemesis.js` already
// imports `pickMoves` from this file — for a value that is handed to us.
function tintOf(e, fallback) {
  const hex = e?._nemesis?.tint;
  if (typeof hex !== 'string' || hex[0] !== '#') return fallback;
  const n = parseInt(hex.slice(1), 16);
  return Number.isFinite(n) ? n : fallback;
}

// A three-tone palette for `groundFractures`, derived from one colour so a
// nemesis cracks the floor in ITS colour rather than in the player's cyan.
function scarPalette(color) {
  const r = (color >> 16) & 0xff, g = (color >> 8) & 0xff, b = color & 0xff;
  const lift = (f) => (Math.min(255, Math.round(r + (255 - r) * f)) << 16)
    | (Math.min(255, Math.round(g + (255 - g) * f)) << 8)
    | Math.min(255, Math.round(b + (255 - b) * f));
  return { body: color, hot: lift(0.45), core: lift(0.8) };
}

export const NEMESIS_MOVES = [
  {
    id: 'charge',
    name: 'CHARGE',
    traits: ['armored', 'colossal', 'swift'],
    everyMs: 8000,
    anticipateMs: WINDUP,
    // 750ms, not 900: the dash must not outrun its own telegraph. See dashPx.
    actMs: 750,
    recoverMs: 1100,
    speed: 820,
    // How far the dash is MEANT to carry, so a test can hold the move to it.
    //
    // Two separate failures live here. "Did the actor move at all" is what let
    // a drag bug ship — every dash covered a sixth of its lane and the check
    // still went green. And this number must stay <= laneLen, because the lane
    // is drawn as a promise about which floor is dangerous: a dash that travels
    // further than its telegraph hits people who correctly stepped past the end
    // of it. Both are now asserted in smoke-moves.
    dashPx: 615,          // 820px/s x 0.75s, inside the 620px lane
    damage: 170,
    laneWidth: 150,      // worst-case escape is half of this: 75px, well inside a dash
    laneLen: 620,

    anticipate(scene, e, h) {
      // Rear back AWAY from the target — the oldest tell in the book, and it
      // reads at a glance even on a 20px sprite.
      const p = scene.player;
      h.angle = Math.atan2(p.y - e.y, p.x - e.x);
      e.body?.setVelocity(0, 0);
      e._holdAim = h.angle;
      rearBack(scene, e, h.angle, 30, this.anticipateMs * 0.5);
      squash(scene, e, this.anticipateMs * 0.7, 0.26);
      e.setMovePose?.('raise');
      h.tint = tintOf(e, 0xff6030);
      h.tel = scene.spawnTelegraph({
        kind: 'lane', x: e.x, y: e.y, angle: h.angle,
        len: this.laneLen, width: this.laneWidth,
      }, { windupMs: this.anticipateMs, owner: e, color: h.tint });
      // Gathering, at the feet. The same idiom the boss's FORCE PUSH uses for
      // its wind-up, which is the one place a repeated `inhale` reads as effort.
      h.gather = scene.time.addEvent({
        delay: 90,
        repeat: Math.floor(this.anticipateMs / 90) - 1,
        callback: () => scene.fx?.inhale?.(e.x, e.y, 'red', 3, 90),
      });
      scene.events.emit('show-banner', 'CHARGE', '#ff6030');
    },

    act(scene, e, h) {
      // Real velocity, not a position tween: a charge has to COLLIDE, and a
      // tweened position walks through walls.
      h.gather?.remove(false);
      e.setMovePose?.('thrust');
      e._charging = true;
      SFX.dash?.();
      charge(scene, e, h.angle, {
        speed: this.speed, ms: this.actMs,
        onEnd: () => { e._charging = false; },
      });
      // The wake is drawn on its own clock rather than per frame from the scene
      // tick: this move already owns a handle, and the streaks only need to
      // land often enough to read as a smear.
      h.wake = scene.time.addEvent({
        delay: 55, loop: true,
        callback: () => {
          if (!e.active || !e._charging) { h.wake?.remove(false); return; }
          scene.fx?.chargeWake?.(e.x, e.y, h.angle, h.tint);
        },
      });
    },

    impact(scene, e, h) {
      e._charging = false;
      // Hitting a wall is the interesting outcome — a big slam and the longest
      // punish window of any move, because a whiffed charge should be the
      // biggest reward for having dodged it.
      const blocked = e.body && (e.body.blocked.left || e.body.blocked.right
        || e.body.blocked.up || e.body.blocked.down);
      h.wake?.remove(false);
      if (blocked) {
        scene.fx?.groundFractures?.(e.x, e.y, 160, scarPalette(h.tint ?? 0xff6030));
        scene.fx?.shake?.(0.03, 320);
        scene.fx?.burst?.(e.x, e.y, 'yellow', 18);
        SFX.meleeSlam?.();
        h.hitWall = true;
      }
    },

    recover(scene, e, h) {
      // A charge that slammed a wall is wide open; one that just ran out of
      // steam is only briefly off-balance.
      e.setMovePose?.('recoil');
      stagger(scene, e, h.hitWall ? this.recoverMs : this.recoverMs * 0.5,
        h.hitWall ? 2.0 : 1.35);
    },

    onCancel(scene, e, h) {
      h?.gather?.remove(false);
      h?.wake?.remove(false);
      e.setMovePose?.(null);
    },

    // Contact damage during the charge is applied by the scene's move tick,
    // which is the only part that needs per-frame work.
    onChargeTouch(scene, e) {
      scene.player.damage(this.damage, Math.atan2(scene.player.y - e.y, scene.player.x - e.x));
    },
  },

  {
    id: 'blink',
    name: 'BLINK STRIKE',
    traits: ['swift', 'summoner', 'regenerator'],
    everyMs: 9000,
    anticipateMs: 520,
    actMs: 760,
    recoverMs: 700,
    speed: 1000,
    damage: 150,
    laneWidth: 130,

    anticipate(scene, e, h) {
      // Vanish, then reappear at the arena edge FARTHEST from the player, so the
      // dash always crosses the room. Reappearing near them would make it an
      // ambush with no readable travel, which is the thing being fixed.
      h.tint = tintOf(e, 0x40ffd0);
      e.setMovePose?.('raise');
      scene.fx?.blinkOut?.(e.x, e.y, h.tint);
      vanish(scene, e, this.anticipateMs * 0.4);
      const b = scene.physics.world.bounds;
      const p = scene.player;
      const corners = [
        { x: 110, y: 110 }, { x: b.width - 110, y: 110 },
        { x: 110, y: b.height - 110 }, { x: b.width - 110, y: b.height - 110 },
      ];
      h.spot = corners.reduce((a, c) =>
        Math.hypot(c.x - p.x, c.y - p.y) > Math.hypot(a.x - p.x, a.y - p.y) ? c : a);

      scene.time.delayedCall(this.anticipateMs * 0.45, () => {
        if (!e.active || !e.alive) return;
        e.setPosition(h.spot.x, h.spot.y);
        e.body?.setVelocity(0, 0);
        appear(scene, e, 200);
        scene.fx?.blinkOut?.(e.x, e.y, h.tint);   // the arrival, same shape inverted
        h.angle = Math.atan2(p.y - e.y, p.x - e.x);
        e._holdAim = h.angle;
        h.tel = scene.spawnTelegraph({
          kind: 'lane', x: e.x, y: e.y, angle: h.angle,
          len: Math.hypot(b.width, b.height), width: this.laneWidth,
        }, { windupMs: this.anticipateMs * 0.5, owner: e, color: h.tint });
      });
      scene.events.emit('show-banner', 'BLINK STRIKE', '#40ffd0');
    },

    act(scene, e, h) {
      if (h.angle == null) return;
      e.setMovePose?.('thrust');
      e._charging = true;
      SFX.meleeSwing?.(1);
      charge(scene, e, h.angle, {
        speed: this.speed, ms: this.actMs,
        onEnd: () => { e._charging = false; },
      });
      // The saber trails through the dash.
      spin(scene, e, { ms: this.actMs, turns: 1 });
    },

    impact(scene, e, h) {
      e._charging = false;
      // `crossCut`, NOT `slashSwipe`. slashSwipe is the stealth-takedown
      // effect — one 5px arc, documented in FX.js as too thin to read as a
      // sword swing — and this move had been borrowing it, which is the same
      // mistake as the boss borrowing the player's Riven kit.
      scene.fx?.crossCut?.(e.x, e.y, e._holdAim || 0, h.tint ?? 0x40ffd0, 70);
      scene.fx?.shake?.(0.012, 140);
      SFX.meleeHit?.();
    },

    recover(scene, e) { e.setMovePose?.('recoil'); stagger(scene, e, this.recoverMs, 1.5); },

    onCancel(scene, e) { e.setMovePose?.(null); },

    onChargeTouch(scene, e) {
      scene.player.damage(this.damage, Math.atan2(scene.player.y - e.y, scene.player.x - e.x));
    },
  },

  {
    id: 'baitslam',
    name: 'OVERHEAD',
    traits: ['armored', 'colossal', 'volatile'],
    everyMs: 7500,
    anticipateMs: 1150,      // deliberately long — the hold IS the move
    actMs: 380,
    recoverMs: 950,
    radius: 155,             // worst-case escape 155px < 228px dash
    damage: 200,

    anticipate(scene, e, h) {
      // The saber goes up and STAYS up, past the point it feels like it should
      // fall. Dodging on instinct dodges too early and you are back inside the
      // circle when it lands. Patience beats it; panic does not.
      const p = scene.player;
      raiseWeapon(scene, e, 260);
      squash(scene, e, 320, 0.18);
      // The pose carries the wind-up. `raiseWeapon` returns null on a melee
      // base, whose weaponSprite is hidden, so half the archetypes had NO tell
      // at all on the move whose whole design is "the hold is the move".
      e.setMovePose?.('raise');
      e.body?.setVelocity(0, 0);
      h.tint = tintOf(e, 0xffb020);
      h.spot = { x: p.x, y: p.y };
      h.tel = scene.spawnTelegraph(
        { kind: 'circle', x: p.x, y: p.y, r: this.radius },
        // anchor: 'world' is NOT optional here. `h.spot` is frozen at cast, but
        // without the anchor `Telegraph._followOwner` drags the drawn circle
        // along with the caster every frame — so the zone you can see and the
        // zone that hurts you are different zones. Same bug that put a second
        // circle on Vader's VANISH, and the same rule: the shape IS the hit test.
        { windupMs: this.anticipateMs, owner: e, color: h.tint, anchor: 'world' },
      );
      scene.events.emit('show-banner', 'OVERHEAD', '#ffb020');
    },

    act(scene, e, h) {
      // A real leap onto the marked spot — the body arrives where the damage is.
      dropWeapon(scene, e, 100);
      e.setMovePose?.('thrust');
      leapArc(scene, e, h.spot, { ms: this.actMs, height: 130 });
    },

    impact(scene, e, h) {
      const s = h.spot;
      scene.fx?.crushRing?.(s.x, s.y, this.radius, h.tint ?? 0xffb020);
      scene.fx?.groundFractures?.(s.x, s.y, this.radius, scarPalette(h.tint ?? 0xffb020));
      scene.fx?.shake?.(0.026, 300);
      SFX.bossSlam?.();
      const p = scene.player;
      if (Math.hypot(p.x - s.x, p.y - s.y) <= this.radius) {
        p.damage(this.damage, Math.atan2(p.y - s.y, p.x - s.x));
      }
    },

    // The heaviest commitment, so the heaviest punish.
    recover(scene, e) { e.setMovePose?.('recoil'); stagger(scene, e, this.recoverMs, 2.0); },

    onCancel(scene, e) { e.setMovePose?.(null); },
  },

  {
    id: 'spiral',
    name: 'SPIRAL',
    traits: ['volatile', 'summoner', 'regenerator'],
    everyMs: 9500,
    anticipateMs: 700,
    actMs: 2200,
    recoverMs: 800,
    arms: 3,
    rateMs: 110,
    speed: 230,
    damage: 60,

    anticipate(scene, e, h) {
      // Wind up the spin itself — the body starts turning before anything fires.
      e.body?.setVelocity(0, 0);
      squash(scene, e, this.anticipateMs, 0.14);
      spin(scene, e, { ms: this.anticipateMs, turns: 1 });
      e.setMovePose?.('raise');
      h.tint = tintOf(e, 0xc080ff);
      // This move had NO effects whatsoever — it span, and then bullets
      // appeared. The counter-rotating arms are the wind-up: something being
      // loaded, rather than something already happening.
      h.whirl = scene.fx?.whirlArms?.(e, 120, this.anticipateMs, h.tint);
      scene.events.emit('show-banner', 'SPIRAL', '#c080ff');
    },

    act(scene, e, h) {
      // No Telegraph zone at all: the BULLETS are the telegraph. They are slow
      // enough to read and the gaps between the arms are real geometry, so the
      // answer is to weave rather than to flee — a different verb from every
      // other move here.
      h.whirl?.stop();
      h.whirl = null;
      e.setMovePose?.('thrust');
      spin(scene, e, { ms: this.actMs, turns: 4 });
      h.rot = Math.random() * Math.PI * 2;
      h.timer = scene.time.addEvent({
        delay: this.rateMs,
        repeat: Math.floor(this.actMs / this.rateMs) - 1,
        callback: () => {
          if (!e.active || !e.alive) return;
          h.rot += 0.42;
          SFX.enemyShoot?.();
          for (let i = 0; i < this.arms; i++) {
            const a = h.rot + (i / this.arms) * Math.PI * 2;
            // Each arm lit as it leaves, so the pattern's origin reads even
            // when the arena is busy.
            scene.fx?.burstDir?.(
              e.x + Math.cos(a) * (e.cfg.radius + 8),
              e.y + Math.sin(a) * (e.cfg.radius + 8),
              'white', 2, a, 18,
            );
            scene.enemyBullets.fire(
              e.x + Math.cos(a) * (e.cfg.radius + 8),
              e.y + Math.sin(a) * (e.cfg.radius + 8),
              a, this.speed, this.damage, 700, { owner: 'enemy' },
            );
          }
        },
      });
    },

    impact(scene, e, h) { h.timer?.remove(false); },
    recover(scene, e) { e.setMovePose?.('recoil'); stagger(scene, e, this.recoverMs, 1.4); },

    // The handle IS forwarded now (`_castNemesisMove` used to drop it), so a
    // cancelled spiral stops firing and takes its rings with it. Before, an
    // interrupted cast left both running: MoveScript.cancel sweeps anything
    // with a .destroy(), and a TimerEvent has neither .destroy() nor a way in.
    onCancel(scene, e, h) {
      h?.timer?.remove(false);
      h?.whirl?.stop();
      e.setMovePose?.(null);
    },
  },

  {
    id: 'rite',
    name: 'SUMMONING RITE',
    traits: ['summoner', 'regenerator', 'armored'],
    everyMs: 11000,
    anticipateMs: 600,
    actMs: 1800,
    recoverMs: 900,
    packs: 2,

    anticipate(scene, e, h) {
      e.body?.setVelocity(0, 0);
      raiseWeapon(scene, e, 300);
      squash(scene, e, 400, 0.2);
      e.setMovePose?.('raise');
      h.tint = tintOf(e, 0xc080ff);
      scene.events.emit('show-banner', 'SUMMONING', '#c080ff');
      h.hpAtStart = e.hp;
    },

    act(scene, e, h) {
      // A growing rune circle under the caster. This is the ONE move where the
      // right answer is to shoot rather than dodge: damage taken during the
      // channel past a threshold breaks it. A fight where every move says "get
      // out of the way" has one verb however many moves it has.
      // The rune lives in FX.js now. It used to be built with
      // `scene.add.graphics()` right here — the only place in the codebase
      // where a DATA module drew anything — which meant the one visual that
      // teaches "shoot this" could not be reused, tinted or screenshotted on
      // its own. `summonRune` follows the caster and returns a handle, matching
      // `forceVortex`.
      e.setMovePose?.('thrust');
      h.rune = scene.fx?.summonRune?.(e, 160, this.actMs, h.tint ?? 0xc080ff);
      h.channel = scene.time.addEvent({
        delay: 40,
        repeat: Math.floor(this.actMs / 40) - 1,
        callback: () => {
          if (!e.active || !e.alive) return;
          // Interrupt check, on the caster's own hp.
          // A FLAT damage bar, not a fraction of max hp.
          //
          // It used to be `> hpMax * 0.06`, which scales the WRONG way: the
          // tougher the nemesis, the more damage the interrupt demanded. 1,200
          // on a 20,000-hp body inside a 1.8s channel, 2,760 on a 46,000-hp
          // one — so the single move whose correct answer is offence quietly
          // stopped being answerable on exactly the enemies it mattered
          // against, and the skill it taught did not transfer between fights.
          // Flat asks the same real commitment of every nemesis.
          if (h.hpAtStart - e.hp > RITE_BREAK_DAMAGE) {
            h.broken = true;
            h.channel?.remove(false);
            h.rune?.stop();
            h.rune = null;
            scene.events.emit('show-banner', 'RITE BROKEN', '#40ff90');
            // Breaking a channel is the one thing in the move set that rewards
            // shooting instead of dodging, and it used to look like a small
            // white puff. It gets the loudest effect the move owns.
            scene.fx?.riteShatter?.(e.x, e.y, h.tint ?? 0xc080ff);
            scene.fx?.shake?.(0.02, 240);
            SFX.superBossHit?.();
            stagger(scene, e, 1400, 2.2);   // the reward for answering it correctly
          }
        },
      });
    },

    impact(scene, e, h) {
      h.channel?.remove(false);
      h.rune?.stop();
      h.rune = null;
      if (h.broken) return;                  // interrupted: nothing arrives
      for (let i = 0; i < this.packs; i++) {
        const a = (i / this.packs) * Math.PI * 2;
        scene._spawnSwarmlingPack?.(e.x + Math.cos(a) * 90, e.y + Math.sin(a) * 90);
      }
      // `'purple'` here rendered WHITE: `burst` only branches on 'red' and
      // 'yellow' and falls through to the white emitter for anything else, so
      // the payoff of the summon has never been the colour it was written as.
      scene.fx?.burst?.(e.x, e.y, 'white', 26);
      scene.fx?.riteShatter?.(e.x, e.y, h.tint ?? 0xc080ff);
      scene.fx?.shake?.(0.02, 260);
      SFX.bossRoar?.();
    },

    recover(scene, e, h) {
      e.setMovePose?.('recoil');
      if (!h.broken) stagger(scene, e, this.recoverMs, 1.5);
    },

    onCancel(scene, e, h) {
      h?.channel?.remove(false);
      h?.rune?.stop();
      e.setMovePose?.(null);
    },
  },
  // ── Signature kit: GRUNT, the brute ────────────────────────────────────
  //
  // Both of these are COMBOS: more than one thing to evade per cast. A single
  // dodge answering a whole move is what made the old kit feel like an obstacle
  // rather than an opponent — you sidestepped once and went back to shooting.

  {
    id: 'slidesmash',
    name: 'SLIDE & SMASH',
    traits: ['armored', 'colossal', 'swift'],
    everyMs: 8000,
    anticipateMs: 750,
    actMs: 450,
    recoverMs: 1050,
    speed: 1150,           // fast and heavy, but bounded by the lane it drew
    dashPx: 518,           // 1150px/s x 0.45s, inside the 520px lane
    laneWidth: 140,        // worst escape 70px, well inside a 228px dash
    laneLen: 520,
    radius: 170,           // the smash, worst escape 170px
    damage: 120,           // the slide
    smashDamage: 210,
    smashWindupMs: 360,

    anticipate(scene, e, h) {
      const p = scene.player;
      h.angle = Math.atan2(p.y - e.y, p.x - e.x);
      e.body?.setVelocity(0, 0);
      e._holdAim = h.angle;
      e.setMovePose?.('raise');
      rearBack(scene, e, h.angle, 26, this.anticipateMs * 0.5);
      squash(scene, e, this.anticipateMs * 0.7, 0.24);
      h.tint = tintOf(e, 0xff6030);
      h.tel = scene.spawnTelegraph({
        kind: 'lane', x: e.x, y: e.y, angle: h.angle,
        len: this.laneLen, width: this.laneWidth,
      }, { windupMs: this.anticipateMs, owner: e, color: h.tint });
      scene.events.emit('show-banner', 'SLIDE & SMASH', e._nemesis?.tint || '#ff6030');
    },

    // The dash is the point. It has to read as a FREIGHT TRAIN — committed,
    // unstoppable, and loud the whole way — not as a step forward. That means
    // the wake is drawn continuously rather than once, the camera stays live
    // through the travel, and contact throws the player rather than pinging
    // them, so being hit by it feels like being hit by a body.
    act(scene, e, h) {
      e._charging = true;
      e._chargeHit = false;
      e.setMovePose?.('thrust');
      SFX.dash?.();
      h.charge = charge(scene, e, h.angle, {
        speed: this.speed, ms: this.actMs,
        onEnd: () => { e._charging = false; },
      });
      h.wake = scene.time.addEvent({
        delay: 45, loop: true,
        callback: () => {
          if (!e.active || !e._charging) { h.wake?.remove(false); return; }
          scene.fx?.chargeWake?.(e.x, e.y, h.angle, h.tint);
          scene.fx?.dustPuff?.(e.x, e.y);
          scene.fx?.shake?.(0.006, 60);   // a rumble under the whole run
        },
      });
    },

    // The second half. The slide is the setup; this is the payoff, and it gets
    // its OWN telegraph at the spot the slide actually ended — so a player who
    // dodged the lane still has a decision to make instead of a free window.
    impact(scene, e, h) {
      e._charging = false;
      h.wake?.remove(false);
      e.body?.setVelocity(0, 0);
      e.setMovePose?.('raise');
      const spot = { x: e.x, y: e.y };
      h.spot = spot;
      // Ending the run against a wall is the loud outcome, same as CHARGE:
      // the slide stops dead, the floor cracks on arrival, and the smash that
      // follows is the same but the whole thing reads as a crash.
      const blocked = e.body && (e.body.blocked.left || e.body.blocked.right
        || e.body.blocked.up || e.body.blocked.down);
      if (blocked) {
        scene.fx?.crushRing?.(e.x, e.y, 130, h.tint);
        scene.fx?.shake?.(0.03, 260);
        SFX.bossSlam?.();
      }
      // World-anchored: the smash lands where the slide stopped. Left to follow
      // the caster it would drift with the recoil and stop being a promise.
      h.tel2 = scene.spawnTelegraph(
        { kind: 'circle', x: spot.x, y: spot.y, r: this.radius },
        { windupMs: this.smashWindupMs, owner: e, color: h.tint, anchor: 'world' },
      );
      h.smash = scene.time.delayedCall(this.smashWindupMs, () => {
        if (!e.active || !e.alive) return;
        e.setMovePose?.('thrust');
        scene.fx?.slamShockwave?.(spot.x, spot.y, this.radius);
        scene.fx?.crushRing?.(spot.x, spot.y, this.radius, h.tint);
        scene.fx?.groundFractures?.(spot.x, spot.y, this.radius, scarPalette(h.tint));
        scene.fx?.shake?.(0.042, 380);
        SFX.meleeSlam?.();
        SFX.bossSlam?.();
        const p = scene.player;
        if (p?.alive && Math.hypot(p.x - spot.x, p.y - spot.y) <= this.radius) {
          p.damage(this.smashDamage, Math.atan2(p.y - spot.y, p.x - spot.x));
        }
        e.setMovePose?.('recoil');
        stagger(scene, e, this.recoverMs - this.smashWindupMs, 2.0);
      });
    },

    // Deliberately empty of a stagger: the punish window opens when the SMASH
    // resolves, not when the slide does. Staggering here would hand the player
    // a reward while the second hit was still coming.
    recover() {},

    // Contact THROWS you. A dash this committed pinging the player for damage
    // and leaving them standing where they were is the thing that makes a big
    // move feel small.
    onChargeTouch(scene, e) {
      const p = scene.player;
      const a = Math.atan2(p.y - e.y, p.x - e.x);
      p.damage(this.damage, a);
      p.body?.setVelocity(Math.cos(a) * KNOCKBACK, Math.sin(a) * KNOCKBACK);
      scene.fx?.impactRing?.(p.x, p.y, tintOf(e, 0xff6030));
      scene.fx?.shake?.(0.03, 220);
    },

    onCancel(scene, e, h) {
      h?.smash?.remove(false);
      h?.wake?.remove(false);
      h?.charge?.stopCharge?.();   // also puts the body's drag back
      h?.tel2?.destroy?.();
    },
  },

  {
    id: 'tripledash',
    name: 'TRIPLE DASH',
    traits: ['swift', 'armored', 'volatile'],
    everyMs: 9500,
    anticipateMs: 700,
    // Three links at ~500ms each, plus headroom. Timers resolve coarsely on a
    // slow frame, and an actMs that only just fits meant the third dash STARTED
    // after the recover beat had already run — the combo finished in a wind-up
    // pose because a link outlived the move that owned it. `h.over` is the
    // actual guard; this is just enough room that it rarely has to fire.
    actMs: 1900,
    recoverMs: 950,
    dashes: 3,
    speed: 980,
    dashPx: 706,          // 3 links x 980px/s x 0.24s
    // Chained: dashPx is the TOTAL, so a per-link comparison against laneLen
    // needs to know how many links it is spread over. Without this the lane
    // check reads a 706px total against a 380px per-link lane and calls a
    // correct move an overrun.
    dashLinks: 3,
    dashMs: 240,
    linkWindupMs: 260,
    laneWidth: 140,
    laneLen: 380,
    damage: 110,

    anticipate(scene, e, h) {
      e.body?.setVelocity(0, 0);
      e.setMovePose?.('raise');
      squash(scene, e, this.anticipateMs * 0.8, 0.2);
      h.tint = tintOf(e, 0x40ff90);
      h.links = [];
      scene.events.emit('show-banner', 'TRIPLE DASH', e._nemesis?.tint || '#40ff90');
    },

    // Three dashes, each RE-AIMED at wherever the player went after the last
    // one. Each link telegraphs for itself: the short 260ms windup is fair only
    // because you are already inside a pattern you were given 700ms to read.
    // A single zone covering all three would be unreadable, and no zone at all
    // is the decal-with-no-body failure this whole file exists to avoid.
    act(scene, e, h) {
      const step = (n) => {
        if (h.over) return;   // the move has left ACT; nothing more may start
        if (n >= this.dashes || !e.active || !e.alive || !scene.player?.alive) return;
        const p = scene.player;
        const angle = Math.atan2(p.y - e.y, p.x - e.x);
        e._holdAim = angle;
        const tel = scene.spawnTelegraph({
          kind: 'lane', x: e.x, y: e.y, angle,
          len: this.laneLen, width: this.laneWidth,
        }, { windupMs: this.linkWindupMs, owner: e, color: h.tint });
        h.links.push(tel);
        rearBack(scene, e, angle, 14, this.linkWindupMs * 0.6);
        h.timer = scene.time.delayedCall(this.linkWindupMs, () => {
          if (!e.active || !e.alive) return;
          e._charging = true;
          e._chargeHit = false;          // each dash may land its own hit
          e.setMovePose?.('thrust');
          scene.fx?.chargeWake?.(e.x, e.y, angle, h.tint);
          charge(scene, e, angle, {
            speed: this.speed, ms: this.dashMs,
            onEnd: () => {
              e._charging = false;
              // Only reset to the ready pose if another dash follows. The last
              // link's onEnd lands AFTER the recover beat, so setting it
              // unconditionally overwrote the recoil pose with a wind-up —
              // the body finished the combo looking like it was starting one.
              if (n + 1 < this.dashes) {
                e.setMovePose?.('raise');
                step(n + 1);
              }
            },
          });
        });
      };
      step(0);
    },

    impact(scene, e, h) {
      h.over = true;
      h.timer?.remove(false);
      e._charging = false;
      h.links.forEach((t) => t?.destroy?.());
      h.links.length = 0;
    },

    recover(scene, e) {
      e.setMovePose?.('recoil');
      stagger(scene, e, this.recoverMs, 1.8);
    },

    onChargeTouch(scene, e) {
      scene.player.damage(this.damage,
        Math.atan2(scene.player.y - e.y, scene.player.x - e.x));
    },

    onCancel(scene, e, h) {
      if (h) h.over = true;
      h?.timer?.remove(false);
      h?.links?.forEach((t) => t?.destroy?.());
      e.setMovePose?.(null);
    },
  },

  // ── Signature kit: BOMBER, the demolisher ──────────────────────────────
  //
  // The bomber used to have exactly one behaviour — walk into the player and
  // die. These give it a reason to keep its distance and a reason to be feared
  // at that distance, which is what makes the archetype survive being a boss.

  {
    id: 'mortar',
    name: 'MORTAR VOLLEY',
    traits: ['volatile', 'colossal', 'summoner'],
    everyMs: 8500,
    anticipateMs: 900,
    actMs: 1800,
    recoverMs: 900,
    shells: 4,
    shellGapMs: 400,
    shellWindupMs: 700,
    radius: 120,
    damage: 150,

    anticipate(scene, e, h) {
      e.body?.setVelocity(0, 0);
      e.setMovePose?.('raise');
      raiseWeapon(scene, e, 280);
      squash(scene, e, 340, 0.2);
      h.tint = tintOf(e, 0xff5030);
      h.shells = [];
      scene.events.emit('show-banner', 'MORTAR VOLLEY', e._nemesis?.tint || '#ff5030');
    },

    // Each shell is lobbed at where the player IS, then lands 700ms later. The
    // move is answered by moving continuously: standing still eats every shell,
    // and one dodge does not answer four.
    act(scene, e, h) {
      h.timer = scene.time.addEvent({
        delay: this.shellGapMs,
        repeat: this.shells - 1,
        callback: () => {
          if (!e.active || !e.alive || !scene.player?.alive) return;
          const p = scene.player;
          const spot = { x: p.x, y: p.y };
          e.setMovePose?.('thrust');
          rearBack(scene, e, Math.atan2(spot.y - e.y, spot.x - e.x), 12, 140);
          scene.fx?.weaponMuzzle?.(e.x, e.y,
            Math.atan2(spot.y - e.y, spot.x - e.x), h.tint, 'lob');
          SFX.enemyShoot?.('lob');
          const tel = scene.spawnTelegraph(
            { kind: 'circle', x: spot.x, y: spot.y, r: this.radius },
            { windupMs: this.shellWindupMs, owner: e, color: h.tint, anchor: 'world' },
          );
          h.shells.push(tel);
          // The shell itself, falling for exactly as long as the zone winds up.
          // If these two disagree the player is watching the one that lies.
          scene.fx?.mortarFall?.(spot.x, spot.y, this.shellWindupMs, h.tint);
          scene.time.delayedCall(this.shellWindupMs, () => {
            if (!scene.scene?.isActive?.()) return;
            scene.fx?.explosion?.(spot.x, spot.y, 1.3);
            scene.fx?.groundFractures?.(spot.x, spot.y, this.radius * 0.8,
              scarPalette(h.tint));
            scene.fx?.shake?.(0.016, 200);
            const pl = scene.player;
            if (pl?.alive && Math.hypot(pl.x - spot.x, pl.y - spot.y) <= this.radius) {
              pl.damage(this.damage, Math.atan2(pl.y - spot.y, pl.x - spot.x));
            }
          });
        },
      });
    },

    impact(scene, e, h) { h.timer?.remove(false); },
    recover(scene, e) {
      e.setMovePose?.('recoil');
      stagger(scene, e, this.recoverMs, 1.6);
    },
    onCancel(scene, e, h) {
      h?.timer?.remove(false);
      h?.shells?.forEach((t) => t?.destroy?.());
    },
  },

  {
    id: 'minefield',
    name: 'MINEFIELD',
    traits: ['volatile', 'swift', 'regenerator'],
    everyMs: 10000,
    anticipateMs: 650,
    actMs: 900,
    recoverMs: 800,
    mines: 5,
    mineGapMs: 160,
    armMs: 900,
    liveMs: 7000,
    radius: 110,
    damage: 160,
    speed: 640,
    dashPx: 576,          // 640px/s x 0.9s

    anticipate(scene, e, h) {
      const p = scene.player;
      // Away from the player — bent toward the arena centre ONLY if a straight
      // retreat would run out of floor.
      //
      // Caught against the top wall, the bomber travelled almost nowhere and
      // dropped all five mines in one pile: the move that is supposed to
      // reshape the arena marked a single spot instead. But bending
      // unconditionally is worse — the first version of this turned the
      // retreat into a diagonal walk TOWARD the player, because the arena
      // centre happened to lie that way. Only bend when there is a wall to
      // avoid, and never far enough to stop reading as a retreat.
      const away = Math.atan2(e.y - p.y, e.x - p.x);
      const b = scene.physics.world.bounds;
      const reach = this.speed * (this.actMs / 1000);
      const endX = e.x + Math.cos(away) * reach;
      const endY = e.y + Math.sin(away) * reach;
      const wouldHitWall = endX < MINE_MARGIN || endX > b.width - MINE_MARGIN
        || endY < MINE_MARGIN || endY > b.height - MINE_MARGIN;
      if (wouldHitWall) {
        const toMid = Math.atan2(b.height / 2 - e.y, b.width / 2 - e.x);
        const bend = Math.atan2(Math.sin(toMid - away), Math.cos(toMid - away));
        h.angle = away + Phaser.Math.Clamp(bend, -MINE_BEND, MINE_BEND);
      } else {
        h.angle = away;
      }
      e.body?.setVelocity(0, 0);
      e.setMovePose?.('raise');
      rearBack(scene, e, h.angle + Math.PI, 22, this.anticipateMs * 0.6);
      h.tint = tintOf(e, 0xff5030);
      h.mines = [];
      scene.events.emit('show-banner', 'MINEFIELD', e._nemesis?.tint || '#ff5030');
    },

    // Retreats and seeds the floor behind it. This is the move that changes the
    // SHAPE of the arena rather than threatening one patch of it: the answer is
    // to reposition before the mines arm, not to dodge on reaction.
    act(scene, e, h) {
      e.setMovePose?.('thrust');
      h.start = { x: e.x, y: e.y };
      h.laid = 0;
      const b0 = scene.physics.world.bounds;
      charge(scene, e, h.angle, { speed: this.speed, ms: this.actMs });
      h.timer = scene.time.addEvent({
        delay: this.mineGapMs,
        repeat: this.mines - 1,
        callback: () => {
          if (!e.active || !e.alive) return;
          // Mines are laid along the retreat's PLANNED path, not at wherever
          // the body happens to be.
          //
          // Reading e.x/e.y each tick sounds more honest and is worse: a
          // retreat that stalls — walled in, shoved, or just a slow frame —
          // drops the whole volley on one spot, and measured against a wall the
          // body covered 64px of an intended 576. The move's job is to make a
          // patch of floor unavailable, so the field has to exist even when the
          // walk does not. The body still retreats along this exact line, so
          // what the player sees and what the floor does still agree.
          const step = h.laid++;
          const mx = clampAxis(h.start.x + Math.cos(h.angle) * MINE_SPACING * (step + 1),
            b0.width);
          const my = clampAxis(h.start.y + Math.sin(h.angle) * MINE_SPACING * (step + 1),
            b0.height);
          const tel = scene.spawnTelegraph(
            { kind: 'circle', x: mx, y: my, r: this.radius },
            { windupMs: this.armMs, owner: e, color: h.tint, anchor: 'world' },
          );
          h.mines.push(tel);
          const dev = scene.fx?.mineArm?.(mx, my, this.armMs, h.tint);
          h.devices = h.devices || [];
          if (dev) h.devices.push(dev);
          let blown = false;
          const blow = () => {
            if (blown) return;
            blown = true;
            poll?.remove(false);
            dev?.stop?.();
            tel?.destroy?.();
            const i = h.mines.indexOf(tel);
            if (i >= 0) h.mines.splice(i, 1);
            scene.fx?.explosion?.(mx, my, 1.1);
            scene.fx?.impactRing?.(mx, my, h.tint);
            scene.fx?.shake?.(0.012, 160);
            const pl = scene.player;
            if (pl?.alive && Math.hypot(pl.x - mx, pl.y - my) <= this.radius) {
              pl.damage(this.damage, Math.atan2(pl.y - my, pl.x - mx));
            }
          };
          // Armed after `armMs`, then trips on proximity or times out. Polled
          // rather than hooked into the frame loop so the mine owns its whole
          // lifetime and cannot outlive its own cleanup.
          let poll = null;
          scene.time.delayedCall(this.armMs, () => {
            // `h.cancelled` as well as `blown`: this callback fires armMs after
            // the mine was laid, which can be AFTER the move was cancelled. A
            // poll registered at that point was never in h.polls when onCancel
            // swept it, so the mine would outlive its owner and go on arming an
            // arena that has moved on. Impact deliberately does NOT stop this —
            // mines are meant to persist past the move; only cancellation kills
            // them.
            if (blown || h.cancelled) { dev?.stop?.(); tel?.destroy?.(); return; }
            let age = 0;
            poll = scene.time.addEvent({
              delay: 80,
              loop: true,
              callback: () => {
                age += 80;
                const pl = scene.player;
                if (!pl?.alive || age >= this.liveMs) { blow(); return; }
                if (Math.hypot(pl.x - mx, pl.y - my) <= this.radius) blow();
              },
            });
            h.polls = h.polls || [];
            h.polls.push(poll);
          });
        },
      });
    },

    impact(scene, e, h) { h.timer?.remove(false); },
    recover(scene, e) {
      e.setMovePose?.('recoil');
      stagger(scene, e, this.recoverMs, 1.5);
    },
    onCancel(scene, e, h) {
      if (h) h.cancelled = true;
      h?.timer?.remove(false);
      h?.polls?.forEach((p) => p?.remove(false));
      h?.devices?.forEach((d) => d?.stop?.());
      h?.mines?.forEach((t) => t?.destroy?.());
    },
  },

  {
    id: 'chaindet',
    name: 'CHAIN DETONATION',
    traits: ['volatile', 'armored', 'colossal'],
    everyMs: 11000,
    anticipateMs: 1400,     // long on purpose — this one is BAITED, not reacted to
    actMs: 300,
    recoverMs: 1200,
    radius: 220,            // just inside DASH_REACH (228): escapable, barely
    damage: 280,

    anticipate(scene, e, h) {
      e.body?.setVelocity(0, 0);
      e.setMovePose?.('raise');
      h.tint = tintOf(e, 0xff5030);
      squash(scene, e, this.anticipateMs, 0.3);
      scene.fx?.inhale?.(e.x, e.y, 'red', 10, this.radius);
      // Follows the caster: it is centred on the bomber's own body, so pinning
      // it to the floor would let it walk out of its own blast.
      h.tel = scene.spawnTelegraph(
        { kind: 'circle', x: e.x, y: e.y, r: this.radius },
        { windupMs: this.anticipateMs, owner: e, color: h.tint },
      );
      scene.events.emit('show-banner', 'CHAIN DETONATION', e._nemesis?.tint || '#ff5030');
    },

    act(scene, e, h) {
      e.setMovePose?.('thrust');
      scene.fx?.crushRing?.(e.x, e.y, this.radius, h.tint);
    },

    impact(scene, e, h) {
      scene.fx?.slamShockwave?.(e.x, e.y, this.radius * 0.8);
      scene.fx?.explosion?.(e.x, e.y, 2.0);
      scene.fx?.groundFractures?.(e.x, e.y, this.radius, scarPalette(h.tint));
      scene.fx?.shake?.(0.034, 380);
      SFX.bossSlam?.();
      const p = scene.player;
      if (p?.alive && Math.hypot(p.x - e.x, p.y - e.y) <= this.radius) {
        p.damage(this.damage, Math.atan2(p.y - e.y, p.x - e.x));
      }
    },

    // The heaviest commitment in the game, so the heaviest punish.
    recover(scene, e) {
      e.setMovePose?.('recoil');
      stagger(scene, e, this.recoverMs, 2.2);
    },
  },
];

const BY_ID = Object.fromEntries(NEMESIS_MOVES.map((m) => [m.id, m]));
export const moveById = (id) => BY_ID[id] || null;

// ── Kits ──────────────────────────────────────────────────────────────────
//
// Movesets used to be chosen by TRAIT alone, two per nemesis, cycled in a fixed
// order. That is why fights blurred together: an ARMORED grunt and an ARMORED
// shooter drew from the same pool and played identically, and with `everyMs`
// between 7.5s and 11s a short fight showed exactly one move.
//
// Identity now comes from the BASE — what the thing is — and traits graft an
// extra move on top of it rather than being the whole of it.
//
// `grunt` and `bomber` are authored. The other three draw from the original
// five while their signature kits are being built; those are real moves that
// work, not stubs, so a shooter nemesis is never worse off than it is today —
// it just is not yet distinctive. Authoring fifteen moves against a framework
// nobody has played is how the last rejected release happened.
export const KITS = {
  grunt:    ['slidesmash', 'tripledash', 'baitslam'],
  bomber:   ['mortar', 'minefield', 'chaindet'],
  shooter:  ['spiral', 'blink', 'charge'],
  shielded: ['charge', 'baitslam', 'spiral'],
  sniper:   ['blink', 'spiral', 'baitslam'],
};

// One extra move per trait, added on top of the base kit.
export const TRAIT_MOVES = {
  armored:     'charge',
  swift:       'tripledash',
  colossal:    'baitslam',
  volatile:    'chaindet',
  summoner:    'rite',
  regenerator: 'spiral',
};

/**
 * Build a nemesis's moveset: base identity plus one move per trait.
 *
 * `rng` is injected like every other encounter decision, so a seed reproduces
 * the moveset along with the traits and the weapon.
 *
 * The kit is deliberately NOT trimmed to a fixed size. A three-trait nemesis
 * carrying six moves is the point — it is the one you remember — and the cast
 * clock cycles whatever it is given.
 */
export function buildKit(base, traits = [], rng) {
  const kit = (KITS[base] || KITS.grunt).slice();
  for (const t of traits) {
    const extra = TRAIT_MOVES[t];
    if (extra && !kit.includes(extra)) kit.push(extra);
  }
  const known = kit.filter((id) => BY_ID[id]);
  return rng ? rng.shuffle(known) : known;
}

/**
 * Back-compat shim: trait-only selection.
 *
 * Kept because it is the shape `smoke-moves` asserts variety against, and
 * because a nemesis rolled without a base still needs a moveset. New callers
 * should use `buildKit`.
 */
export function pickMoves(traits = [], rng, count = 2) {
  let usable = NEMESIS_MOVES.filter((m) => m.traits.some((t) => traits.includes(t)));
  if (usable.length < count) {
    const rest = NEMESIS_MOVES.filter((m) => !usable.includes(m));
    usable = usable.concat(rng ? rng.shuffle(rest) : rest);
  }
  const picked = rng ? rng.sample(usable, count) : usable.slice(0, count);
  return picked.map((m) => m.id);
}

/** The fairness bound, exported so the test and the design share one number. */
export const FAIRNESS_REACH = DASH_REACH;
