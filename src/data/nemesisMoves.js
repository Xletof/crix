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

// Windup floor. ~250ms is raw human reaction; the rest is thumb travel plus the
// fact that the player is usually mid-decision about something else.
const WINDUP = 800;

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
      h.tel = scene.spawnTelegraph({
        kind: 'lane', x: e.x, y: e.y, angle: h.angle,
        len: this.laneLen, width: this.laneWidth,
      }, { windupMs: this.anticipateMs, owner: e });
      scene.events.emit('show-banner', 'CHARGE', '#ff6030');
    },

    act(scene, e, h) {
      // Real velocity, not a position tween: a charge has to COLLIDE, and a
      // tweened position walks through walls.
      e._charging = true;
      charge(scene, e, h.angle, {
        speed: this.speed, ms: this.actMs,
        onEnd: () => { e._charging = false; },
      });
    },

    impact(scene, e, h) {
      e._charging = false;
      // Hitting a wall is the interesting outcome — a big slam and the longest
      // punish window of any move, because a whiffed charge should be the
      // biggest reward for having dodged it.
      const blocked = e.body && (e.body.blocked.left || e.body.blocked.right
        || e.body.blocked.up || e.body.blocked.down);
      if (blocked) {
        scene.fx?.groundFractures?.(e.x, e.y, 160);
        scene.fx?.shake?.(0.03, 320);
        scene.fx?.burst?.(e.x, e.y, 'yellow', 18);
        h.hitWall = true;
      }
    },

    recover(scene, e, h) {
      // A charge that slammed a wall is wide open; one that just ran out of
      // steam is only briefly off-balance.
      stagger(scene, e, h.hitWall ? this.recoverMs : this.recoverMs * 0.5,
        h.hitWall ? 2.0 : 1.35);
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
        h.angle = Math.atan2(p.y - e.y, p.x - e.x);
        e._holdAim = h.angle;
        h.tel = scene.spawnTelegraph({
          kind: 'lane', x: e.x, y: e.y, angle: h.angle,
          len: Math.hypot(b.width, b.height), width: this.laneWidth,
        }, { windupMs: this.anticipateMs * 0.5, owner: e });
      });
      scene.events.emit('show-banner', 'BLINK STRIKE', '#40ffd0');
    },

    act(scene, e, h) {
      if (h.angle == null) return;
      e._charging = true;
      charge(scene, e, h.angle, {
        speed: this.speed, ms: this.actMs,
        onEnd: () => { e._charging = false; },
      });
      // The saber trails through the dash.
      spin(scene, e, { ms: this.actMs, turns: 1 });
    },

    impact(scene, e) {
      e._charging = false;
      scene.fx?.slashSwipe?.(e.x, e.y, e._holdAim || 0, 70, 0x40ffd0);
    },

    recover(scene, e) { stagger(scene, e, this.recoverMs, 1.5); },

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
      e.body?.setVelocity(0, 0);
      h.spot = { x: p.x, y: p.y };
      h.tel = scene.spawnTelegraph(
        { kind: 'circle', x: p.x, y: p.y, r: this.radius },
        { windupMs: this.anticipateMs, owner: e },
      );
      scene.events.emit('show-banner', 'OVERHEAD', '#ffb020');
    },

    act(scene, e, h) {
      // A real leap onto the marked spot — the body arrives where the damage is.
      dropWeapon(scene, e, 100);
      leapArc(scene, e, h.spot, { ms: this.actMs, height: 130 });
    },

    impact(scene, e, h) {
      const s = h.spot;
      scene.fx?.groundFractures?.(s.x, s.y, this.radius);
      scene.fx?.explosion?.(s.x, s.y, 1.5);
      scene.fx?.shake?.(0.026, 300);
      const p = scene.player;
      if (Math.hypot(p.x - s.x, p.y - s.y) <= this.radius) {
        p.damage(this.damage, Math.atan2(p.y - s.y, p.x - s.x));
      }
    },

    // The heaviest commitment, so the heaviest punish.
    recover(scene, e) { stagger(scene, e, this.recoverMs, 2.0); },
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
      scene.events.emit('show-banner', 'SPIRAL', '#c080ff');
    },

    act(scene, e, h) {
      // No Telegraph zone at all: the BULLETS are the telegraph. They are slow
      // enough to read and the gaps between the arms are real geometry, so the
      // answer is to weave rather than to flee — a different verb from every
      // other move here.
      spin(scene, e, { ms: this.actMs, turns: 4 });
      h.rot = Math.random() * Math.PI * 2;
      h.timer = scene.time.addEvent({
        delay: this.rateMs,
        repeat: Math.floor(this.actMs / this.rateMs) - 1,
        callback: () => {
          if (!e.active || !e.alive) return;
          h.rot += 0.42;
          for (let i = 0; i < this.arms; i++) {
            const a = h.rot + (i / this.arms) * Math.PI * 2;
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
    recover(scene, e) { stagger(scene, e, this.recoverMs, 1.4); },
    onCancel(scene, e) { /* timer cleared by the handle's own cancel path */ },
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
      scene.events.emit('show-banner', 'SUMMONING', '#c080ff');
      h.hpAtStart = e.hp;
    },

    act(scene, e, h) {
      // A growing rune circle under the caster. This is the ONE move where the
      // right answer is to shoot rather than dodge: damage taken during the
      // channel past a threshold breaks it. A fight where every move says "get
      // out of the way" has one verb however many moves it has.
      h.rune = scene.add.graphics().setDepth(12);
      h.t = 0;
      h.channel = scene.time.addEvent({
        delay: 40,
        repeat: Math.floor(this.actMs / 40) - 1,
        callback: () => {
          if (!e.active || !e.alive || !h.rune?.active) return;
          h.t = Math.min(1, h.t + 40 / this.actMs);
          const r = 40 + 120 * h.t;
          h.rune.clear();
          h.rune.lineStyle(3, 0xc080ff, 0.9);
          h.rune.strokeCircle(e.x, e.y, r);
          h.rune.lineStyle(2, 0x9060e0, 0.6);
          h.rune.strokeCircle(e.x, e.y, r * 0.6);
          for (let i = 0; i < 6; i++) {
            const a = h.t * 4 + (i / 6) * Math.PI * 2;
            h.rune.fillStyle(0xe0b0ff, 0.9);
            h.rune.fillCircle(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, 4);
          }
          // Interrupt check, on the caster's own hp.
          if (h.hpAtStart - e.hp > (e.hpMax * 0.06)) {
            h.broken = true;
            h.channel?.remove(false);
            h.rune?.destroy();
            h.rune = null;
            scene.events.emit('show-banner', 'RITE BROKEN', '#40ff90');
            scene.fx?.burst?.(e.x, e.y, 'white', 20);
            stagger(scene, e, 1400, 2.2);   // the reward for answering it correctly
          }
        },
      });
    },

    impact(scene, e, h) {
      h.channel?.remove(false);
      h.rune?.destroy();
      h.rune = null;
      if (h.broken) return;                  // interrupted: nothing arrives
      for (let i = 0; i < this.packs; i++) {
        const a = (i / this.packs) * Math.PI * 2;
        scene._spawnSwarmlingPack?.(e.x + Math.cos(a) * 90, e.y + Math.sin(a) * 90);
      }
      scene.fx?.burst?.(e.x, e.y, 'purple', 26);
      scene.fx?.shake?.(0.02, 260);
    },

    recover(scene, e, h) {
      if (!h.broken) stagger(scene, e, this.recoverMs, 1.5);
    },

    onCancel(scene, e) { /* handle cleanup runs in impact */ },
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
