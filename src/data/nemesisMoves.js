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

import { DASH_REACH } from '../systems/Telegraph.js';
import {
  squash, rearBack, leapArc, charge, spin, vanish, appear,
  raiseWeapon, dropWeapon, stagger,
} from '../systems/actorMotion.js';
import { SFX } from '../systems/FX.js';

// Windup floor. ~250ms is raw human reaction; the rest is thumb travel plus the
// fact that the player is usually mid-decision about something else.
const WINDUP = 800;

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
    actMs: 900,
    recoverMs: 1100,
    speed: 820,
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
          if (h.hpAtStart - e.hp > (e.hpMax * 0.06)) {
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
];

const BY_ID = Object.fromEntries(NEMESIS_MOVES.map((m) => [m.id, m]));
export const moveById = (id) => BY_ID[id] || null;

/**
 * Two moves for a nemesis, gated by its traits.
 *
 * `rng` is injected like every other encounter decision, so a seed reproduces
 * the moveset along with the traits and the weapon. An untraited nemesis still
 * gets moves — otherwise it would be the only enemy in the game with nothing to
 * dodge, which reads as a bug rather than as a breather.
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
