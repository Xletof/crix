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
import { SFX } from '../systems/FX.js';

export const BOSS_MOVES = [
  {
    id: 'sabercombo',
    name: 'SABER COMBO',
    minPhase: 1,
    // His DEFAULT attack, and the reason he now has a reason to be at saber
    // range instead of standing on top of you. Cast by the close-range branch
    // of his state machine rather than the rotation clock — see Boss.preUpdate.
    close: true,
    everyMs: 3200,
    anticipateMs: 420,
    actMs: 900,
    recoverMs: 850,
    reach: 150,
    arcDeg: 120,
    hitDamage: 130,
    slamRadius: 190,
    slamDamage: 240,
    slamKnockback: 620,
    stepPx: 26,
    minGapPx: 74,      // he closes to here and no further

    anticipate(scene, b, h) {
      const p = scene.player;
      h.angle = Math.atan2(p.y - b.y, p.x - b.x);
      b.body?.setVelocity(0, 0);
      b.setMovePose?.('raise');
      raiseWeapon(scene, b, 200);
      rearBack(scene, b, h.angle, 14, 180);
      // A tell on the BODY. Caught by smoke-readability on this move's first
      // run — the same gap SABER THROW had, which is exactly why that check
      // iterates the registry instead of naming moves.
      squash(scene, b, 260, 0.16);
      scene.events.emit('show-banner', 'SABER COMBO', '#ff6030');
      // Short wind-up on purpose: this is his bread-and-butter, not an event.
      // The reading that matters is the FINISHER, which telegraphs separately.
      h.tel = scene.spawnTelegraph({
        kind: 'cone', x: b.x, y: b.y, angle: h.angle,
        len: this.reach, spreadDeg: this.arcDeg,
      }, { windupMs: this.anticipateMs, owner: b, color: 0xff5030 });
    },

    act(scene, b, h) {
      b.setMovePose?.('thrust');
      h.swing = 0;
      // Three quick swings, each stepping him in so a backpedal does not
      // trivially outrun the combo, each mirrored against the last so the pair
      // reads as a chain rather than one animation played three times.
      h.swings = scene.time.addEvent({
        delay: this.actMs / 3,
        repeat: 2,
        startAt: this.actMs / 3 - 1,
        callback: () => {
          if (!b.active || !b.alive) return;
          const p = scene.player;
          const a = Math.atan2(p.y - b.y, p.x - b.x);
          h.swing += 1;
          b._aim = a;
          scene.fx?.saberSweep?.(b.x, b.y, a, 92, h.swing === 2 ? -1 : 1);
          scene.fx?.shake?.(0.008, 90);
          SFX.meleeSwing?.(h.swing);
          // Step in along the swing — but never INTO them. Unclamped, three
          // 26px steps walked him from standoff to zero and he finished the
          // combo standing inside the player, which is the same overlap the
          // stand-off range exists to prevent.
          const gap = Math.hypot(p.x - b.x, p.y - b.y);
          const step = Math.min(this.stepPx, Math.max(0, gap - this.minGapPx));
          b.setPosition(b.x + Math.cos(a) * step, b.y + Math.sin(a) * step);
          const half = (this.arcDeg * Math.PI) / 180 / 2;
          const d = Math.hypot(p.x - b.x, p.y - b.y);
          const off = Math.abs(Math.atan2(Math.sin(a - h.angle), Math.cos(a - h.angle)));
          if (p.alive && d <= this.reach && off <= half + 0.35) {
            p.damage(this.hitDamage, a);
          }
          h.angle = a;
        },
      });
    },

    // The finisher: a radial slam, which is the beat worth dodging and the one
    // with a real punish window behind it.
    impact(scene, b, h) {
      h.swings?.remove(false);
      dropWeapon(scene, b, 120);
      const p = scene.player;
      scene.fx?.saberSlam?.(b.x, b.y, this.slamRadius);
      scene.fx?.shake?.(0.03, 320);
      SFX.meleeSlam?.();
      if (p?.alive && Math.hypot(p.x - b.x, p.y - b.y) <= this.slamRadius) {
        const a = Math.atan2(p.y - b.y, p.x - b.x);
        p.damage(this.slamDamage, a);
        p.body?.setVelocity(Math.cos(a) * this.slamKnockback, Math.sin(a) * this.slamKnockback);
      }
    },

    recover(scene, b) { b.setMovePose?.('recoil'); stagger(scene, b, this.recoverMs, 1.8); },
    onCancel(scene, b, h) { b.setMovePose?.(null); h?.swings?.remove(false); },
  },
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
      // A tell on the BODY, not just on the weapon. Caught by
      // smoke-readability: this move's only anticipation was a weapon raise and
      // a 24px lean, so at a glance — on a phone, mid-fight — Vader simply
      // stood there and then a saber was in the air.
      squash(scene, b, 380, 0.22);
      b.setMovePose?.('raise');
      scene.fx?.inhale?.(b.x, b.y, 'red', 4, 170);
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
      b.setMovePose?.('thrust');
      b._saberAway = true;
      b._noMelee = true;
      const from = { x: b.x, y: b.y };
      const to = {
        x: b.x + Math.cos(h.angle) * this.reach,
        y: b.y + Math.sin(h.angle) * this.reach,
      };
      h.saberTo = to;

      // Spin for the whole flight — the one thing that WAS right about this.
      scene.tweens.add({
        targets: w, rotation: (w.rotation || 0) + Math.PI * 8,
        duration: this.actMs, ease: 'Linear',
      });

      // ── IT IS A BOOMERANG, SO IT FLIES BOTH WAYS ─────────────────────────
      //
      // The return used to be a tween to `b.x, b.y` CAPTURED AT SCHEDULE TIME,
      // running the back half of the act beat — and `impact` then snapped the
      // sprite into his hand the moment the beat ended. At ~20fps the coarse
      // delayedCall lands late, impact wins the race, and the flight home never
      // renders: "when it still spins it teleports back to Vader's hand, so not
      // like a boomerang".
      //
      // Now it is integrated per frame, the way the cluster munitions in FX.js
      // fly: the blade carries a velocity, and on the way back it steers toward
      // where Vader ACTUALLY IS. He can walk while it is out and it still finds
      // him, which is the whole appeal of the throw. Nothing snaps it — it
      // arrives, and arriving is what ends the flight.
      // ── THE OUTBOUND LEG HAS TO ACTUALLY GET THERE ──────────────────────
      //
      // The first version decayed the speed 4.5% per 16ms tick AND turned round
      // at a speed floor of 25%. Those two together fire after 31 ticks, which
      // is 248px of a 620px reach — it turned round 40% of the way out. "Sword
      // swing doesn't go all the way, it returns prematurely", and the
      // arithmetic says exactly that.
      //
      // The turn is now DISTANCE ONLY. Deceleration is gentle enough to read as
      // the throw losing steam without ever being what ends the leg, and the
      // speed floor is gone as a trigger — the blade goes the whole way or the
      // move is lying about its own reach, which is also what the lane on the
      // floor promised.
      const OUT_SPEED = this.reach / (this.actMs * 0.00045);   // reach in 45% of act
      h.blade = {
        vx: Math.cos(h.angle) * OUT_SPEED,
        vy: Math.sin(h.angle) * OUT_SPEED,
        returning: false,
        home: false,
        last: scene.time.now,
      };
      // LOOP until it is home, do not budget ticks.
      //
      // This was `repeat: actMs/16 + 40`, which assumes one tick per 16ms. At a
      // low frame rate Phaser's clock catches up by firing several events in
      // one frame while the blade only advances once — so the budget burned ~3x
      // faster than the blade flew, ran out mid-flight, and the saber simply
      // stopped 553px away and hung there. It ends when it is caught, when the
      // move is cancelled, or on a hard safety cutoff.
      h.flyDeadline = scene.time.now + this.actMs * 3;
      h.fly = scene.time.addEvent({
        delay: 16,
        loop: true,
        callback: () => {
          const s = h.blade;
          if (!w.active || !b.active || s.home) return;
          // REAL elapsed time, not a fixed 16ms. The timer fires once per frame
          // whatever the frame rate, so a hardcoded dt made the blade fly at a
          // third speed on a slow machine — the throw's whole trip took three
          // times as long as its own beats and the catch never happened inside
          // the move. Clamped so one stalled frame cannot teleport it.
          const now = scene.time.now;
          if (now > h.flyDeadline) {          // never leak a looping timer
            s.home = true;
            b._saberAway = false;
            b._noMelee = false;
            if (w.active) { w.x = b.x; w.y = b.y; }
            h.fly?.remove(false);
            return;
          }
          const dt = Math.min(0.05, Math.max(0.001, (now - s.last) / 1000));
          s.last = now;

          if (!s.returning) {
            // Outbound: decelerate toward the far point, and turn around when
            // it has run out of push. Deceleration is what sells the hang at
            // the top of the arc.
            w.x += s.vx * dt;
            w.y += s.vy * dt;
            // Gentle, and per SECOND rather than per tick so it does not
            // change character with the frame rate.
            const decay = Math.pow(0.6, dt);
            s.vx *= decay;
            s.vy *= decay;
            if (Math.hypot(w.x - from.x, w.y - from.y) >= this.reach * 0.97) {
              s.returning = true;
              scene.fx?.impactRing?.(w.x, w.y, 0xff6040, 26);
              scene.fx?.burst?.(w.x, w.y, 'red', 8);
            }
          } else {
            // Homing: accelerate along the bearing to his CURRENT position.
            const a = Math.atan2(b.y - w.y, b.x - w.x);
            const pull = 3400;
            s.vx += Math.cos(a) * pull * dt;
            s.vy += Math.sin(a) * pull * dt;
            const sp = Math.hypot(s.vx, s.vy);
            const cap = OUT_SPEED * 1.35;
            if (sp > cap) { s.vx *= cap / sp; s.vy *= cap / sp; }
            w.x += s.vx * dt;
            w.y += s.vy * dt;
            scene.fx?.trail?.(w.x, w.y);
            if (Math.hypot(w.x - b.x, w.y - b.y) < 26) {
              // Caught. THIS is what ends the flight, not the clock.
              s.home = true;
              b._saberAway = false;
              b._noMelee = false;
              scene.fx?.saberSweep?.(b.x, b.y, b._aim || 0, 80, 1);
              scene.fx?.burst?.(b.x, b.y, 'red', 10);
              dropWeapon(scene, b, 140);
              h.fly?.remove(false);
            }
          }
        },
      });

      // Damage on both passes, checked against the saber's live position.
      h.hitTimer = scene.time.addEvent({
        delay: 40,
        repeat: Math.floor(this.actMs / 40) + 20,
        callback: () => {
          if (!w.active || h.hitPlayer || h.blade?.home) return;
          const p = scene.player;
          if (p?.alive && Math.hypot(p.x - w.x, p.y - w.y) < 52) {
            h.hitPlayer = true;
            p.damage(this.damage, Math.atan2(p.y - w.y, p.x - w.x));
          }
        },
      });
    },

    // IMPACT DOES NOT CATCH THE SABER. The blade's own flight decides when it
    // is home, and it announces that itself — see `act`. All this beat does is
    // stop the damage ticker; snapping the sprite here is exactly what made the
    // return read as a teleport.
    impact(scene, b, h) {
      h.hitTimer?.remove(false);
    },

    // The longest window he has: he spent the whole flight without a weapon.
    recover(scene, b) { b.setMovePose?.('recoil'); stagger(scene, b, this.recoverMs, 2.0); },
    onCancel(scene, b, h) {
      // An interrupted throw must not strand the blade in mid-air: stop the
      // flight and hand it straight back, because nothing else will now.
      h?.fly?.remove(false);
      h?.hitTimer?.remove(false);
      if (h?.blade) h.blade.home = true;
      b._saberAway = false;
      b._noMelee = false;
      b.setMovePose?.(null);
      const w = b.weaponSprite;
      if (w?.active) { w.x = b.x; w.y = b.y; w.rotation = b._aim || 0; }
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
    // The telegraph is a CIRCLE at this radius: the drag reaches anywhere
    // inside it, from any bearing.
    pullRadius: 300,
    // The cone is still the SWING that lands after the drag — a saber arc in
    // front of him — which is genuinely directional. Two different things that
    // were previously conflated into one wrong shape.
    coneDeg: 90,
    coneLen: 210,
    damage: 190,

    anticipate(scene, b, h) {
      b.body?.setVelocity(0, 0);
      raiseWeapon(scene, b, 320);
      squash(scene, b, 400, 0.2);
      b.setMovePose?.('raise');
      scene.events.emit('show-banner', 'FORCE PULL', '#8060ff');
      // A CIRCLE, because the pull comes from every direction.
      //
      // This drew a 90-degree cone while `act` dragged the player in from
      // wherever they stood — the telegraph was describing a different move
      // from the one that ran. "Force pull shouldn't just have quarter circle
      // animation if it's pulling from anywhere, directionality doesn't make
      // sense." The shape now matches the hit, which is the one property of
      // this whole system that must never be false.
      h.tel = scene.spawnTelegraph({
        kind: 'circle', x: b.x, y: b.y, r: this.pullRadius,
      }, { windupMs: this.anticipateMs, owner: b, color: 0xa070ff });
      // The vortex proper — spirals, a counter-rotating ring and a rising core.
      // Not `inhale`: that is four motes on straight lines and this move is the
      // one being judged on its effect.
      h.vortex = scene.fx?.forceVortex?.(b, this.pullRadius, this.anticipateMs + this.actMs);
      h.ring = scene.add.graphics().setDepth(12);
      h.t = 0;
    },

    act(scene, b, h) {
      // Writes the player's velocity toward him each frame. The threat is not
      // damage, it is WHERE IT PUTS YOU — and dashing has i-frames and more
      // speed than the pull, so committing a dash beats it. That is what keeps
      // it a decision instead of a cutscene.
      b.setMovePose?.('thrust');
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
      h.vortex?.stop?.();
      h.ring?.destroy();
      h.ring = null;
      // Then the swing that the pull set up.
      const p = scene.player;
      const a = Math.atan2(p.y - b.y, p.x - b.x);
      dropWeapon(scene, b, 120);
      scene.fx?.saberSweep?.(b.x, b.y, a, 96, -1);
      scene.fx?.shake?.(0.018, 220);
      const half = (this.coneDeg * Math.PI) / 180 / 2;
      const d = Math.hypot(p.x - b.x, p.y - b.y);
      const off = Math.abs(Math.atan2(Math.sin(a - (b._aim ?? a)), Math.cos(a - (b._aim ?? a))));
      if (d <= this.coneLen && off <= half + 0.3) p.damage(this.damage, a);
    },

    recover(scene, b) { b.setMovePose?.('recoil'); stagger(scene, b, this.recoverMs, 1.6); },
    onCancel(scene, b, h) {
      b.setMovePose?.(null);
      h?.pull?.remove(false);
      h?.vortex?.stop?.();
      h?.ring?.destroy();
    },
  },

  {
    id: 'vanishslash',
    name: 'VANISH',
    // OFF THE ROTATION. `bossMovesFor` excludes anything flagged `reactive`;
    // Boss.preUpdate casts this directly when the player bursts him down. It
    // was on the rotation and appeared on a timer whether or not it made any
    // sense — "he should use it when I give too much damage but not spam every
    // time".
    reactive: true,
    minPhase: 1,
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
      // ANCHORED TO THE WORLD, not to him. This is a LANDING marker: it says
      // "he will arrive here", so it has to stay put while he is elsewhere.
      //
      // Without the anchor it inherited the follow-the-caster behaviour added
      // for every other zone, and the result was exactly the report: the marker
      // trailed him through the wind-up, he teleported to the spot captured at
      // cast time, and the still-live zone then snapped onto his new position —
      // "another circle appears for a brief time and goes away". My regression;
      // the anchor was in the plan and never applied.
      h.tel = scene.spawnTelegraph(
        { kind: 'circle', x: h.spot.x, y: h.spot.y, r: this.radius },
        { windupMs: this.anticipateMs, owner: b, anchor: 'world' },
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

    recover(scene, b) { b.setMovePose?.('recoil'); stagger(scene, b, this.recoverMs, 1.7); },
  },

  {
    id: 'forcepush',
    name: 'FORCE PUSH',
    // Phase 1. It used to be gated to phase 2, and with VANISH also gated the
    // phase-1 pool was literally two moves — "there's only two moves I see more
    // frequently than others". The pool is the variety; there is no reason to
    // hold most of it back until he is already half dead.
    minPhase: 1,
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
      b.setMovePose?.('raise');
      scene.events.emit('show-banner', 'FORCE PUSH', '#a0c0ff');
      // The other move that drew NOTHING. A 420px shove that costs a dash
      // charge is a big deal and it arrived with no warning whatsoever.
      // The expanding fill doubles as the range read: if the sweep reaches you
      // before it commits, you are getting thrown.
      h.tel = scene.spawnTelegraph(
        { kind: 'circle', x: b.x, y: b.y, r: this.radius },
        { windupMs: this.anticipateMs, owner: b, color: 0x90b8ff },
      );
      h.inhale = scene.time.addEvent({
        delay: 55,
        repeat: Math.floor(this.anticipateMs / 55),
        callback: () => scene.fx?.inhale?.(b.x, b.y, 'blue', 4, 240),
      });
    },

    act(scene, b, h) {
      // No damage at all. It takes your POSITION and one dash charge, which is
      // worse than damage in the moment: whatever he does next lands on a
      // player who is out of place and out of options.
      b.setMovePose?.('thrust');
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
      h.inhale?.remove(false);
      // `slamShockwave` instead of one thin ring and a puff of sparks. It is
      // already in FX.js and it is already the right effect: three-layer ADD
      // ring, a second ring launched late so it reads as a shock TRAVELLING,
      // a dust column out of the epicentre, debris thrown along the ring, and
      // ground fractures. The quality bar this move needed was in the repo the
      // whole time; the move just never called it.
      scene.fx?.forceWave?.(b.x, b.y, this.radius * 0.8);
      scene.fx?.shake?.(0.03, 340);
    },

    impact(scene, b, h) {
      scene.fx?.burst?.(b.x, b.y, 'white', 22);
    },

    recover(scene, b) { b.setMovePose?.('recoil'); stagger(scene, b, this.recoverMs, 1.5); },
    onCancel(scene, b, h) { b.setMovePose?.(null); h?.inhale?.remove(false); },
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
    .filter((m) => !m.reactive && !m.close)
    .filter((m) => m.minPhase <= phase || encounter >= 3)
    .map((m) => m.id);
}
