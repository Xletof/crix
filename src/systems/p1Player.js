// P1-B + P1-C — THE PLAYER'S SUPER-READY INDICATOR AND WEAPON LAYER
// (`?visualPilot=v2c&polish=p1`).
//
// OPT-IN AND PRESENTATION ONLY. `installPlayerPolish(scene)` runs from
// GameScene.create right after the Player exists and does nothing without the
// flag. `entities/Player.js` is NOT edited: the seam READS the player's state
// (aim, facing, timers, meters — the same fields its own preUpdate reads) and
// draws its own objects from the scene's POST_UPDATE, after physics has synced
// the body for the frame. It writes no gameplay field, draws no `Math.random`,
// and creates its display objects once — nothing is allocated per frame.
//
// ONE AUTHOR PER OBJECT. Under P1 the shipped `weaponSprite` and `superAura`
// keep being driven by Player.preUpdate exactly as before (their state is not
// gameplay, but leaving the code path alone keeps flag-off and flag-on
// running the same entity code); they are simply never drawn — the weapon is
// hidden once at install (Player never touches its visibility) and the aura,
// which Player re-shows every frame it has charge, is hidden here each frame
// before render. P1 draws its own: `p1Weapon` (one Image) and the indicator
// (three Graphics built once, then only moved, rotated, scaled and faded).
//
// P1-B, WHAT WAS WRONG. Any Super charge drew a red-orange (0xff4020) filled
// disc and ring under the hero — the colour family of every enemy threat ring
// and telegraph — growing and then pulsing at full charge. In a crowded fight
// the player read as one more threat.
//
// P1-B, THE READ NOW — by SHAPE and MOTION first, colour second:
//   charging  a quiet SEGMENTED GAUGE: six thin arc segments on the ground ring
//             (no fill), lit clockwise from the top as the meter fills. It does
//             not move. Cool steel-blue.
//   ready     the segments LOCK: thicker, ice-white, with six violet-blue
//             wedges (pawls) in the gaps, pointing out, and the whole ring
//             TURNS slowly — the only rotating thing in the game that belongs
//             to the hero. Every
//             1.1s the wedges kick outward once (a mechanical heartbeat, not
//             a glow pulse). On the frame it becomes ready, one white ping ring
//             expands and fades. His weapon swaps to its `-hot` variant (P1-C):
//             the power cell / scope lens white-hot, the top edge lit.
//   spent     on the Super's release the ring snaps outward and fades (180ms).
//   offline   Vader's SUPPRESSION with a full meter: the ring stays, dim and
//             still — the Super is there but not available.
// No disc, no fill, no red/orange. Distinct from the cyan "you are here" ring
// (a soft filled circle, inside it), the shield (a filled cyan bubble drawn
// OVER him), enemy rings (red, filled) and his own Super shot (a red slug).
//
// P1-C, THE HOLD. The new weapons (p1Paint.js) carry the hero's own glove and
// cuff. They sit on the AIM RAY exactly as the shipped overlay did — bore on
// the line from his centre along the aim, so the bolt (spawned by gameplay at
// PLAYER.radius + 12 along that ray) leaves the barrel's front, not its side —
// with the glove at the reach his painted forward hand has in profile. Recoil,
// facing, flip, depth-behind-when-facing-north and the melee swing offsets are
// the shipped rules, read from the same fields.

import Phaser from 'phaser';
import { PLAYER } from '../config.js';
import { isPolishP1 } from './debug.js';
import { P1_WEAPONS } from './p1Paint.js';

export const P1_SUPER = {
  radius: PLAYER.radius + 24,   // 46: clear of the cyan ring's 36px fill and his pauldrons
  segments: 6,
  segArc: 0.62,                 // fraction of each 60-degree slot that is lit metal
  charge: { width: 2, track: 0x5a6f8c, trackA: 0.30, lit: 0xa9c4ee, litA: 0.70, steps: 48 },
  ready: { width: 3.5, color: 0xeef8ff, alpha: 0.95, tick: 0x8c9cff, tickA: 0.95, spinDegPerSec: 42, beatMs: 1100 },
  ping: { color: 0xffffff, grow: 26, ms: 320 },
  spend: { scale: 1.4, ms: 180 },
  offlineAlpha: 0.32,
  bushAlpha: 0.3,
};

/** Install the P1 player layer on this GameScene run. No-op without the flag. */
export function installPlayerPolish(scene) {
  if (!isPolishP1() || !scene.player) return null;
  const P = scene.player;
  const ctl = new PlayerPolish(scene, P);
  scene._p1Player = ctl;
  const step = (t, d) => ctl.update(t, d);
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, step);
  const onSuper = () => ctl.onSuperFired();
  scene.events.on('player-fire-super', onSuper);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, step);
    scene.events.off('player-fire-super', onSuper);
    ctl.destroy();
    scene._p1Player = null;
  });
  return ctl;
}

class PlayerPolish {
  constructor(scene, P) {
    this.scene = scene;
    this.P = P;
    // the shipped overlay is never drawn under P1 (Player never sets its visibility)
    P.weaponSprite?.setVisible(false);
    this.weapon = scene.add.image(P.x, P.y, P1_WEAPONS.pistol.key).setOrigin(...P1_WEAPONS.pistol.origin);
    // the indicator: built once
    this.gauge = scene.add.graphics().setVisible(false);
    this.ring = scene.add.graphics().setVisible(false);
    this.ticks = scene.add.graphics().setVisible(false);
    this.ping = scene.add.graphics().setVisible(false);
    this._drawRing();
    this._drawTicks();
    this._drawPing();
    this._gaugeStep = -1;
    this._wasReady = false;
    this._spin = 0;
    this._beat = 0;
    this._spending = false;
  }

  // ── built once ───────────────────────────────────────────────────────────
  _slot(i) { return -Math.PI / 2 + (i * Math.PI * 2) / P1_SUPER.segments; }
  _segHalf() { return (Math.PI / P1_SUPER.segments) * P1_SUPER.segArc; }
  _drawRing() {
    const g = this.ring, S = P1_SUPER, R = S.radius, h = this._segHalf();
    g.clear();
    g.lineStyle(S.ready.width, S.ready.color, S.ready.alpha);
    for (let i = 0; i < S.segments; i++) {
      const c = this._slot(i) + Math.PI / S.segments;
      g.beginPath(); g.arc(0, 0, R, c - h, c + h, false); g.strokePath();
      // a squared end-cap pip on each segment's leading end: machined, not drawn
      const a = c + h;
      g.fillStyle(S.ready.color, S.ready.alpha);
      g.fillRect(Math.cos(a) * R - 2, Math.sin(a) * R - 2, 4, 4);
    }
  }
  _drawTicks() {
    // a solid wedge in each gap, pointing OUT — a locked mechanism's pawls
    const g = this.ticks, S = P1_SUPER, R = S.radius;
    g.clear();
    g.fillStyle(S.ready.tick, S.ready.tickA);
    for (let i = 0; i < S.segments; i++) {
      const a = this._slot(i), c = Math.cos(a), s = Math.sin(a);
      const px = -s, py = c, r0 = R - 2, r1 = R + 9;
      g.fillTriangle(c * r0 + px * 5, s * r0 + py * 5, c * r0 - px * 5, s * r0 - py * 5, c * r1, s * r1);
    }
  }
  _drawPing() {
    const g = this.ping;
    g.clear();
    g.lineStyle(2, P1_SUPER.ping.color, 1);
    g.strokeCircle(0, 0, P1_SUPER.radius);
  }
  // redrawn only when the quantised charge changes (1/48 steps), never per frame
  _drawGauge(t) {
    const g = this.gauge, S = P1_SUPER, C = S.charge, R = S.radius, h = this._segHalf();
    g.clear();
    g.lineStyle(C.width, C.track, C.trackA);
    for (let i = 0; i < S.segments; i++) {
      const c = this._slot(i) + Math.PI / S.segments;
      g.beginPath(); g.arc(0, 0, R, c - h, c + h, false); g.strokePath();
    }
    // lit clockwise from the top: segment i covers [i/6, (i+1)/6) of the meter
    g.lineStyle(C.width + 1, C.lit, C.litA);
    for (let i = 0; i < S.segments; i++) {
      const f = Phaser.Math.Clamp(t * S.segments - i, 0, 1);
      if (f <= 0) break;
      const c = this._slot(i) + Math.PI / S.segments;
      g.beginPath(); g.arc(0, 0, R, c - h, c - h + 2 * h * f, false); g.strokePath();
    }
  }

  onSuperFired() {
    // the release: the locked ring snaps outward and goes
    if (!this.ring.visible) return;
    this._spending = true;
    const tw = this.scene.tweens;
    tw.killTweensOf([this.ring, this.ticks]);
    tw.add({
      targets: [this.ring, this.ticks], scale: P1_SUPER.spend.scale, alpha: 0,
      duration: P1_SUPER.spend.ms, ease: 'Quad.easeOut',
      onComplete: () => { this._spending = false; this.ring.setVisible(false).setScale(1); this.ticks.setVisible(false).setScale(1); },
    });
  }

  update(time, delta) {
    const P = this.P;
    if (!P?.scene) return;
    const shown = P.alive && P.visible && P.active !== false;
    const bush = P.hiddenInBush;
    // the shipped aura is never drawn under P1
    if (P.superAura?.visible) P.superAura.setVisible(false);
    this._updateIndicator(delta, shown, bush);
    this._updateWeapon(shown, bush);
  }

  _updateIndicator(delta, shown, bush) {
    const P = this.P, S = P1_SUPER;
    const t = Math.min(1, (P.superCharge || 0) / PLAYER.superHitsToCharge);
    const ready = t >= 1;
    const y = P.y, depth = P.y - 3;
    const baseA = bush ? S.bushAlpha : 1;

    // charging gauge
    if (shown && t > 0 && !ready) {
      const step = Math.ceil(t * S.charge.steps);
      if (step !== this._gaugeStep) { this._gaugeStep = step; this._drawGauge(step / S.charge.steps); }
      this.gauge.setVisible(true).setPosition(P.x, y).setDepth(depth).setAlpha(baseA);
    } else if (this.gauge.visible) {
      this.gauge.setVisible(false);
    }

    // ready ring
    if (shown && ready) {
      const offline = P._suppressedMs > 0;
      if (!this._wasReady) {
        // becoming ready: reset any spend tween, ping once
        this.scene.tweens.killTweensOf([this.ring, this.ticks]);
        this._spending = false;
        this.ring.setScale(1); this.ticks.setScale(1);
        this._beat = 0;
        if (!offline) this._firePing();
      }
      if (!offline) { this._spin += delta * S.ready.spinDegPerSec / 1000; this._beat += delta; }
      const beatT = (this._beat % S.ready.beatMs) / S.ready.beatMs;
      // the heartbeat: a sharp kick out over the first 12% of the beat, settle by 40%
      const kick = offline ? 0 : (beatT < 0.12 ? beatT / 0.12 : Math.max(0, 1 - (beatT - 0.12) / 0.28));
      const a = baseA * (offline ? S.offlineAlpha : 1);
      const rot = Phaser.Math.DegToRad(this._spin % 360);
      this.ring.setVisible(true).setPosition(P.x, y).setDepth(depth).setRotation(rot).setAlpha(a * (0.86 + 0.14 * kick));
      this.ticks.setVisible(true).setPosition(P.x, y).setDepth(depth).setRotation(rot).setAlpha(a).setScale(1 + 0.16 * kick);
    } else if (!this._spending && (this.ring.visible || this.ticks.visible)) {
      this.ring.setVisible(false); this.ticks.setVisible(false);
    } else if (this._spending) {
      this.ring.setPosition(P.x, y).setDepth(depth); this.ticks.setPosition(P.x, y).setDepth(depth);
    }
    if (this.ping.visible) {
      // the ready ping belongs to a live hero: a death inside its 320ms ends it
      if (!shown) { this.scene.tweens.killTweensOf(this.ping); this.ping.setVisible(false); }
      else this.ping.setPosition(P.x, y).setDepth(depth);
    }
    this._wasReady = shown && ready;
  }

  _firePing() {
    const g = this.ping, S = P1_SUPER;
    this.scene.tweens.killTweensOf(g);
    g.setVisible(true).setAlpha(0.9).setScale(1).setPosition(this.P.x, this.P.y).setDepth(this.P.y - 3);
    this.scene.tweens.add({
      targets: g, alpha: 0, scale: (S.radius + S.ping.grow) / S.radius,
      duration: S.ping.ms, ease: 'Cubic.easeOut',
      onComplete: () => g.setVisible(false),
    });
  }

  _updateWeapon(shown, bush) {
    // The shipped overlay's rules (Player.preUpdate, "Weapon overlay"), read
    // from the same fields, drawn with the P1 art and hold.
    const P = this.P, w = this.weapon;
    const baseAng = P.superAiming ? P.superAim : P.aiming ? P.aim : P.facing;
    const inCombo = P._meleeAnimT > 0;
    const ready = (P.superCharge || 0) >= PLAYER.superHitsToCharge && !(P._suppressedMs > 0);
    let spec, key;
    if (inCombo) { spec = P1_WEAPONS.blade; key = spec.key; }
    else {
      spec = P.secondary === 'rifle' ? P1_WEAPONS.rifle : P1_WEAPONS.pistol;
      key = ready ? spec.hot : spec.key;
    }
    if (w.texture.key !== key) w.setTexture(key);
    if (w.originX !== spec.origin[0] || w.originY !== spec.origin[1]) w.setOrigin(spec.origin[0], spec.origin[1]);
    // recoil: the shipped kick, normalised by this shot's own duration
    const kickBack = P._wKickT > 0 ? Phaser.Math.Clamp(P._wKickT / (P._wKickDur || 80), 0, 1) * (P._wKickMag || 0) : 0;
    let ang = baseAng, offset;
    if (inCombo) {
      ang = baseAng + P._meleeBladeOffset();
      offset = PLAYER.radius - 8;                 // the shipped blade's reach
    } else {
      offset = spec.reach - kickBack;
    }
    w.x = P.x + Math.cos(ang) * offset;
    w.y = P.y + Math.sin(ang) * offset;
    w.rotation = ang;
    w.setFlipY(Math.abs(baseAng) > Math.PI / 2);
    w.setAlpha(shown ? (bush ? PLAYER.bushAlpha : 1) : 0);
    const deg = Phaser.Math.RadToDeg(baseAng);
    w.setDepth(deg < -45 && deg > -135 ? P.y - 1 : P.y + 1);
  }

  destroy() {
    for (const o of [this.weapon, this.gauge, this.ring, this.ticks, this.ping]) {
      this.scene?.tweens?.killTweensOf(o);
      o?.destroy();
    }
    this.weapon = this.gauge = this.ring = this.ticks = this.ping = null;
    this.P = null;
  }
}
