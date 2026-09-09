// ── CHAMPION MOVES — THE INTERDICTOR ────────────────────────────────────────
//
// PHASE B, AND A CANDIDATE. Two moves. Not five, not a mini-boss kit: this
// thing has to be legible standing inside a CROSSFIRE with eight troopers on
// the floor, and the number of simultaneous claims a portrait phone can carry
// is small. Two excellent attacks beat six generic ones, and the pair is chosen
// as a SEMANTIC PAIR rather than as two sources of damage:
//
//   INTERDICT takes distant space — it draws a line through where you are and
//             leaves it there for five and a half seconds.
//   PURGE     takes near space — it fires only when you have come inside, which
//             is the obvious answer to a floor seam, and makes that answer cost.
//
// Together they say: there is a right distance from this machine, and it keeps
// walking, so the right distance keeps moving. That is a spatial problem, which
// is the verb the six ordinary enemies could not produce.
//
// WHAT IS DELIBERATELY REUSED, and it is engineering only: `MoveScript`'s four
// beats and its cancellation contract, `Telegraph`'s shape-is-the-hit-test
// primitive, the `actorMotion` body verbs, and the registry-plus-smoke-test
// pattern. What is NOT reused is every piece of Nemesis CONTENT — no generated
// name, no traits, no regalia, no grudge, no ledger, no duel bar, and none of
// its fourteen moves. The human's verdict on that content was that it reads as
// an enlarged normal enemy, and inheriting it is inheriting the verdict.
//
// NO BANNER. Vader's moves announce themselves by name; this one must not, and
// that is a quality decision rather than an omission. The Champion's whole
// claim is that the model, the wind-up and the effect explain the mechanic on
// their own — a move that only reads because its name is printed across the top
// of the screen has communicated nothing, which is the rule `?nonames=1` exists
// to test on Vader. A Champion starts where Vader had to be argued to.
import Phaser from 'phaser';
import { CHAMPION } from '../config.js';
import { squash, rearBack } from '../systems/actorMotion.js';
import { SFX } from '../systems/FX.js';

const CFG = CHAMPION.interdictor;

export const CHAMPION_MOVES = [
  {
    id: 'interdict',
    name: 'INTERDICT',
    everyMs: CFG.interdict.everyMs,
    anticipateMs: CFG.interdict.anticipateMs,
    actMs: CFG.interdict.actMs,
    recoverMs: CFG.interdict.recoverMs,

    /**
     * A LINE THROUGH WHERE YOU ARE, aimed once, at the start of the wind-up.
     *
     * Aiming at cast rather than at impact is what makes the 900ms a real
     * window: the promise is made early and then kept exactly, so stepping off
     * the line beats it outright. A lane re-aimed at release would be a
     * homing attack wearing a telegraph, which is the shape of unfairness this
     * project already rejected once in FORCE PULL's cone.
     */
    anticipate(scene, e, h) {
      const p = scene.player;
      h.angle = Math.atan2(p.y - e.y, p.x - e.x);
      // Frozen at cast. The telegraph is world-anchored to this spot and the
      // barrier is built from the same three numbers, so the warning and the
      // hazard cannot land in different places.
      //
      // Pushed one body-radius FORWARD, and that is a readability fix rather
      // than a nicety. Started at the Champion's centre the near anchor is
      // drawn underneath a 112px sprite, so the one end that says "this came
      // out of that machine" is the one end you cannot see — the same shape as
      // the console whose light was drawn beneath the console. It also means a
      // player standing beside the Champion is not inside its seam by accident.
      const off = e.def?.radius ?? 30;
      h.ox = e.x + Math.cos(h.angle) * off;
      h.oy = e.y + Math.sin(h.angle) * off;
      e.body?.setVelocity(0, 0);
      e.setMovePose?.('raise');
      e._champCharge = 1;
      // The body has to do something, or this is a telegraph with an enemy
      // standing next to it — the exact failure MoveScript was written against.
      // A machine bracing before it fires is a settle, not a lunge.
      squash(scene, e, CFG.interdict.anticipateMs * 0.8, 0.13);

      h.tel = scene.spawnTelegraph({
        kind: 'lane',
        x: h.ox, y: h.oy, angle: h.angle,
        len: CFG.interdict.laneLen, width: CFG.interdict.laneWidth,
      }, {
        windupMs: CFG.interdict.anticipateMs,
        owner: e,
        color: CFG.color,
        // The zone marks a PLACE, not a body. Without this it drifts with the
        // caster's recoil and stops being a promise about a piece of floor.
        anchor: 'world',
        // Chevrons at the speed the seam will actually grow, running OUTWARD:
        // the motion is a preview of where the thing comes from and which way
        // it goes, which is the one job the kinetic layer has.
        kineticMs: CFG.interdict.growMs * 2.2,
        kinetic: 'out',
        // Strictly narrower than the zone on commit. A full-width fan would
        // over-claim; the seam is a line down the axis and the bloom says so.
        bloom: 'spear',
      });
      SFX.champCharge?.();
    },

    act(scene, e, h) {
      e.setMovePose?.('thrust');
      e._champCharge = 1;
      // Recoil BACKWARD along the line it just fired. Newton, and it is also
      // what visually attributes the seam to this machine rather than to the
      // floor: something left, and it went that way.
      rearBack(scene, e, h.angle, 12, 180);

      // ONE SEAM AT A TIME, ALWAYS. A second barrier while the first is live is
      // how a controller becomes a floor that is permanently closed — the
      // failure mode §7 of the brief names as chain-casting. The Champion owns
      // exactly one and replaces it, so the total claimed floor is bounded no
      // matter how long the fight runs or how many Champions the encounter has.
      e.retireBarrier?.();
      const b = scene.spawnBarrier?.({
        x: h.ox, y: h.oy, angle: h.angle,
        len: CFG.interdict.laneLen,
        width: CFG.interdict.laneWidth,
        lifeMs: CFG.interdict.lifeMs,
        growMs: CFG.interdict.growMs,
        warnMs: CFG.interdict.warnMs,
        damage: CFG.interdict.tickDamage,
        tickMs: CFG.interdict.tickMs,
        color: CFG.color,
        owner: e,
      });
      if (b) e._barrier = b;
      SFX.champSeam?.();
      scene.fx?.shake?.(0.006, 180);
    },

    recover(scene, e, h) {
      e.setMovePose?.('recoil');
      e._champCharge = 0;
    },
  },

  {
    id: 'purge',
    name: 'PURGE',
    everyMs: CFG.purge.everyMs,
    anticipateMs: CFG.purge.anticipateMs,
    actMs: CFG.purge.actMs,
    recoverMs: CFG.purge.recoverMs,
    // THE GATE THAT MAKES THIS A PUNISH RATHER THAN A SECOND ATTACK. Read by
    // the Champion's scheduler: if the player is not inside `range`, the move
    // is not eligible at all. A player who keeps their distance never sees it,
    // which is correct — it exists to close ONE answer (stand on the machine so
    // it cannot usefully draw a line through you), not to add damage.
    nearOnly: CFG.purge.range,

    anticipate(scene, e, h) {
      e.body?.setVelocity(0, 0);
      e.setMovePose?.('raise');
      e._champCharge = 1;
      squash(scene, e, CFG.purge.anticipateMs * 0.8, 0.18);
      h.tel = scene.spawnTelegraph({
        kind: 'circle', x: e.x, y: e.y, r: CFG.purge.radius,
      }, {
        windupMs: CFG.purge.anticipateMs,
        owner: e,
        color: CFG.color,
        // OUT, not in. The ring says which way the move points, and this one
        // throws you away from the machine. A slam's inward ring on a shove is
        // the exact reading error FORCE PUSH shipped with.
        kinetic: 'out',
        kineticMs: CFG.purge.anticipateMs,
      });
      SFX.champCharge?.();
    },

    act(scene, e, h) {
      e.setMovePose?.('thrust');
      const p = scene.player;
      // The zone follows the caster while it winds up, so resolving against the
      // CASTER's live position is what keeps the drawing and the hit test in
      // step. Reading the telegraph's own `contains` would be better still, but
      // its geometry is this circle and the caster is its origin.
      if (p?.alive) {
        const d = Math.hypot(p.x - e.x, p.y - e.y);
        if (d <= CFG.purge.radius) {
          const a = Math.atan2(p.y - e.y, p.x - e.x);
          p.damage(CFG.purge.damage, a);
          p.body?.setVelocity(Math.cos(a) * CFG.purge.knockback, Math.sin(a) * CFG.purge.knockback);
        }
      }
      scene.fx?.impactRing?.(e.x, e.y, CFG.color, 25);
      scene.fx?.burst?.(e.x, e.y, 'white', 14);
      scene.fx?.shake?.(0.012, 220);
      SFX.champPurge?.();
    },

    recover(scene, e, h) {
      e.setMovePose?.('recoil');
      e._champCharge = 0;
    },
  },
];

export const championMoveById = (id) => CHAMPION_MOVES.find((m) => m.id === id) || null;
