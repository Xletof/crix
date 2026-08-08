// Vader's moves.
//
// ── Why this file exists separately ───────────────────────────────────────
//
// The five moves in `nemesisMoves.js` were wired to `_spawnMiniBoss` and
// nothing else. `_tickNemesisMoves` iterates `this.enemies`, and the boss is
// deliberately NOT in that group, so Vader never had a single one of them. He
// kept running his original state machine — charge, bullet fan, spawn minions —
// which is why the report came back as "he only charges but no lane light".
//
// The nemesis moves are also built for a 20px body in a crowd. Vader is 40px,
// alone, and has a saber. His moves are his own.
//
// ── The same four beats ───────────────────────────────────────────────────
//
// ANTICIPATE / ACT / IMPACT / RECOVER, through `runMove`, which throws if ACT
// is missing. Everything here moves him: he throws the saber and is briefly
// unarmed, he drags you in, he vanishes, he shoves you across the room.
//
// The recovery windows are where the fight is won. His pool is large and there
// is no damage cap any more, so a punished window is worth real damage.

import {
  squash, rearBack, leapArc, charge, spin, vanish, appear,
  raiseWeapon, dropWeapon, stagger,
} from '../systems/actorMotion.js';

export const BOSS_MOVES = [
  {
    id: 'saberthrow',
    name: 'SABER THROW',
    minPhase: 1,
    everyMs: 9000,
    anticipateMs: 700,
    actMs: 1500,
    recoverMs: 700,
    reach: 620,
    laneWidth: 150,
    damage: 220,

    anticipate(scene, b, h) {
      const p = scene.player;
      h.angle = Math.atan2(p.y - b.y, p.x - b.x);
      b.body?.setVelocity(0, 0);
      raiseWeapon(scene, b, 300);
      rearBack(scene, b, h.angle, 24, 300);
      h.tel = scene.spawnTelegraph({
        kind: 'lane', x: b.x, y: b.y, angle: h.angle,
        len: this.reach, width: this.laneWidth,
      }, { windupMs: this.anticipateMs, owner: b });
      scene.events.emit('show-banner', 'SABER THROW', '#ff2828');
    },

    act(scene, b, h) {
      // The saber actually LEAVES him. `weaponSprite` is detached and flown out
      // and back, so "he is unarmed" is a thing you can see rather than a flag.
      const w = b.weaponSprite;
      if (!w?.active) return;
      b._saberAway = true;
      b._noMelee = true;
      const from = { x: b.x, y: b.y };
      const to = {
        x: b.x + Math.cos(h.angle) * this.reach,
        y: b.y + Math.sin(h.angle) * this.reach,
      };
      h.saberTo = to;

      // Out, spinning, then back on a second path — two passes, one dodge each.
      scene.tweens.add({
        targets: w, x: to.x, y: to.y,
        duration: this.actMs * 0.45, ease: 'Quad.easeOut',
      });
      scene.tweens.add({
        targets: w, rotation: (w.rotation || 0) + Math.PI * 8,
        duration: this.actMs, ease: 'Linear',
      });
      scene.time.delayedCall(this.actMs * 0.5, () => {
        if (!b.active || !b.alive || !w.active) return;
        // The return lane is offset, so standing still after the first pass is
        // not automatically safe.
        const back = h.angle + 0.4;
        h.returnTel = scene.spawnTelegraph({
          kind: 'lane', x: to.x, y: to.y, angle: back + Math.PI,
          len: this.reach, width: this.laneWidth,
        }, { windupMs: 260, owner: b });
        scene.tweens.add({
          targets: w, x: b.x, y: b.y,
          duration: this.actMs * 0.5, ease: 'Quad.easeIn',
        });
      });

      // Damage on both passes, checked against the saber's live position.
      h.hitTimer = scene.time.addEvent({
        delay: 40,
        repeat: Math.floor(this.actMs / 40) - 1,
        callback: () => {
          if (!w.active || h.hitPlayer) return;
          const p = scene.player;
          if (p?.alive && Math.hypot(p.x - w.x, p.y - w.y) < 52) {
            h.hitPlayer = true;
            p.damage(this.damage, Math.atan2(p.y - w.y, p.x - w.x));
          }
        },
      });
    },

    impact(scene, b, h) {
      h.hitTimer?.remove(false);
      b._saberAway = false;
      b._noMelee = false;
      const w = b.weaponSprite;
      if (w?.active) { w.x = b.x; w.y = b.y; w.rotation = b._aim || 0; }
      // Back to rest. This move raised the weapon and never lowered it, which
      // is how the saber's scale compounded 35% per throw.
      dropWeapon(scene, b, 140);
      scene.fx?.bladeArc?.(b.x, b.y, b._aim || 0, 80, 1);   // the catch
    },

    // The longest window he has: he spent the whole flight without a weapon.
    recover(scene, b) { stagger(scene, b, this.recoverMs, 2.0); },
    onCancel(scene, b) {
      b._saberAway = false;
      b._noMelee = false;
      dropWeapon(scene, b, 80);      // an interrupted throw must not keep the raise
    },
  },

  {
    id: 'forcepull',
    name: 'FORCE PULL',
    minPhase: 1,
    everyMs: 11000,
    anticipateMs: 750,
    actMs: 900,
    recoverMs: 800,
    pullSpeed: 420,
    coneDeg: 90,
    coneLen: 210,
    damage: 190,

    anticipate(scene, b, h) {
      b.body?.setVelocity(0, 0);
      raiseWeapon(scene, b, 320);
      squash(scene, b, 400, 0.2);
      scene.events.emit('show-banner', 'FORCE PULL', '#8060ff');
      h.ring = scene.add.graphics().setDepth(12);
      h.t = 0;
    },

    act(scene, b, h) {
      // Writes the player's velocity toward him each frame. The threat is not
      // damage, it is WHERE IT PUTS YOU — and dashing has i-frames and more
      // speed than the pull, so committing a dash beats it. That is what keeps
      // it a decision instead of a cutscene.
      h.pull = scene.time.addEvent({
        delay: 16,
        repeat: Math.floor(this.actMs / 16) - 1,
        callback: () => {
          const p = scene.player;
          if (!b.active || !b.alive || !p?.alive) return;
          if (p.isDashing) return;                 // the escape
          const a = Math.atan2(b.y - p.y, b.x - p.x);
          p.body?.setVelocity(Math.cos(a) * this.pullSpeed, Math.sin(a) * this.pullSpeed);
          if (h.ring?.active) {
            h.t += 0.12;
            h.ring.clear();
            h.ring.lineStyle(3, 0x8060ff, 0.8);
            const r = 200 - (h.t * 40) % 160;
            h.ring.strokeCircle(b.x, b.y, Math.max(30, r));
          }
        },
      });
    },

    impact(scene, b, h) {
      h.pull?.remove(false);
      h.ring?.destroy();
      h.ring = null;
      // Then the swing that the pull set up.
      const p = scene.player;
      const a = Math.atan2(p.y - b.y, p.x - b.x);
      dropWeapon(scene, b, 120);
      scene.fx?.bladeArc?.(b.x, b.y, a, 96, 2);
      scene.fx?.shake?.(0.018, 220);
      const half = (this.coneDeg * Math.PI) / 180 / 2;
      const d = Math.hypot(p.x - b.x, p.y - b.y);
      const off = Math.abs(Math.atan2(Math.sin(a - (b._aim ?? a)), Math.cos(a - (b._aim ?? a))));
      if (d <= this.coneLen && off <= half + 0.3) p.damage(this.damage, a);
    },

    recover(scene, b) { stagger(scene, b, this.recoverMs, 1.6); },
    onCancel(scene, b, h) { h?.pull?.remove(false); h?.ring?.destroy(); },
  },

  {
    id: 'vanishslash',
    name: 'VANISH',
    minPhase: 2,
    everyMs: 10000,
    anticipateMs: 620,
    actMs: 700,
    recoverMs: 750,
    damage: 210,
    radius: 150,

    anticipate(scene, b, h) {
      vanish(scene, b, 260);
      b.body?.setVelocity(0, 0);
      scene.events.emit('show-banner', 'VANISH', '#6040a0');
      const p = scene.player;
      // Lands BEHIND you relative to where he was — punishes camping at one
      // range, and the marker is what stops it being an unreadable ambush.
      const away = Math.atan2(p.y - b.y, p.x - b.x);
      h.spot = {
        x: Phaser.Math.Clamp(p.x + Math.cos(away) * 130, 90, scene.physics.world.bounds.width - 90),
        y: Phaser.Math.Clamp(p.y + Math.sin(away) * 130, 90, scene.physics.world.bounds.height - 90),
      };
      h.tel = scene.spawnTelegraph(
        { kind: 'circle', x: h.spot.x, y: h.spot.y, r: this.radius },
        { windupMs: this.anticipateMs, owner: b },
      );
    },

    act(scene, b, h) {
      b.setPosition(h.spot.x, h.spot.y);
      appear(scene, b, 240);
      spin(scene, b, { ms: this.actMs, turns: 1 });
    },

    impact(scene, b, h) {
      const p = scene.player;
      scene.fx?.slashSwipe?.(b.x, b.y, b._aim || 0, 90, 0xff4040);
      scene.fx?.shake?.(0.02, 220);
      if (Math.hypot(p.x - h.spot.x, p.y - h.spot.y) <= this.radius) {
        p.damage(this.damage, Math.atan2(p.y - b.y, p.x - b.x));
      }
    },

    recover(scene, b) { stagger(scene, b, this.recoverMs, 1.7); },
  },

  {
    id: 'forcepush',
    name: 'FORCE PUSH',
    minPhase: 2,
    everyMs: 12000,
    anticipateMs: 700,
    actMs: 400,
    recoverMs: 900,
    radius: 420,
    knockback: 900,

    anticipate(scene, b, h) {
      b.body?.setVelocity(0, 0);
      rearBack(scene, b, Math.atan2(scene.player.y - b.y, scene.player.x - b.x), 26, 300);
      squash(scene, b, 420, 0.24);
      scene.events.emit('show-banner', 'FORCE PUSH', '#a0c0ff');
    },

    act(scene, b, h) {
      // No damage at all. It takes your POSITION and one dash charge, which is
      // worse than damage in the moment: whatever he does next lands on a
      // player who is out of place and out of options.
      const p = scene.player;
      const a = Math.atan2(p.y - b.y, p.x - b.x);
      h.pushed = Math.hypot(p.x - b.x, p.y - b.y) <= this.radius;
      if (h.pushed && p.alive) {
        p.body?.setVelocity(Math.cos(a) * this.knockback, Math.sin(a) * this.knockback);
        if (p.dashCharges > 0) {
          p.dashCharges -= 1;
          scene.events.emit('player-dash-changed', p.dashCharges);
        }
      }
      scene.fx?.impactRing?.(b.x, b.y, 0xa0c0ff);
      scene.fx?.shake?.(0.024, 300);
    },

    impact(scene, b, h) {
      scene.fx?.burst?.(b.x, b.y, 'white', 22);
    },

    recover(scene, b) { stagger(scene, b, this.recoverMs, 1.5); },
  },
];

const BY_ID = Object.fromEntries(BOSS_MOVES.map((m) => [m.id, m]));
export const bossMoveById = (id) => BY_ID[id] || null;

/**
 * Which moves Vader has, given his phase and encounter number.
 *
 * Phase-gated so the fight escalates in VERBS rather than in numbers — the
 * whole reason his old ladder was rebuilt. Encounter number widens the pool
 * too, so a later Vader opens with things the first one never had.
 */
export function bossMovesFor(phase = 1, encounter = 1) {
  return BOSS_MOVES
    .filter((m) => m.minPhase <= phase || encounter >= 3)
    .map((m) => m.id);
}
