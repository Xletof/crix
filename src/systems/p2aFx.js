// P2-A — BLASTER FIRE & IMPACT (`?visualPilot=v2c&polish=p1&fxPilot=p2a`).
//
// OPT-IN AND PRESENTATION ONLY. `installFxP2A(scene)` runs from
// GameScene.create right after the P1 layer and does nothing without the
// flag. It covers the player's ORDINARY fire — the pistol (`playerBullets`)
// and the DC-15 rifle (`playerRifleBullets`) — from the barrel to the contact.
// Supers, melee, the cluster pod, enemy fire, Vader (his DEFLECTION, his hits)
// and the Bulwark's field are left exactly as they are.
//
// ── WHAT WAS WRONG (the baseline, measured on P1 at 60 Hz) ───────────────
//  MUZZLE   The shipped flash is spawned where the bolt spawns, 34px out —
//           8px (pistol) / 14px (rifle) INSIDE the P1 barrel — and at flat
//           depth 34, under the whole y-sorted actor band: the hero and his
//           own gun are drawn over it. In rendered frames it is not visible.
//           Pistol and rifle share it.
//  BOLT     One 60x15 texture for both weapons, stretched x1.45 / x1.52 into
//           a rigid ~88px bar from the first frame (lying back across the gun
//           and the glove), identical in shape to the enemies' green bolts,
//           and at depth 26 — under every actor and every piece of cover, so
//           its head slides under the target before it lands.
//  BODY     An 8px red ring (the colour family of every enemy threat ring), 7
//           red sparks, 4 more omnidirectional from the body CENTRE. The
//           enemy's own white flash carries the whole read. The bolt's 30px
//           hitbox means the ring often sits in the air in front of the body.
//  METAL    Sparks, a grey ring, a white pop and the scorch — all at depth
//           <= 27, i.e. UNDER the cover art (cover sorts at y + 56 and its art
//           overhangs its 70px body by 21px a side). A shot into a crate shows
//           no contact at all. The spray went straight back along the bolt.
//  SHIELD   The roster-v1 Bulwark's field answers a block itself (frozen; not
//           touched here). A shield-bearer WITHOUT the field (a nemesis
//           Bulwark, any legacy-art bearer) answered with a blue ring and the
//           HEALING sparkle — bubbles rising — for a block.
//
// ── THE SEAM ─────────────────────────────────────────────────────────────
//  1. The two groups' `fire` (instance wrappers): every bolt is registered
//     for a tracer and its sprite is hidden (`visible`; its texture, body,
//     scale and every gameplay field are untouched — the hitbox still comes
//     from the `bullet` texture's width).
//  2. `firePlayerPrimary` / `firePlayerRifle`, `handleBulletEnemyHits` /
//     `handleBulletWallHits` and `_impactMicroFlash` (instance wrappers) only
//     raise a CONTEXT flag around the shipped code, which runs unchanged.
//  3. Inside that context, and matched on its exact arguments, the shipped
//     fx calls it replaces are intercepted on the fx instance:
//       muzzleFlash                       -> the P2-A muzzle (no draws either way)
//       impactRing  red / grey / blue / amber-on-armour -> dropped (no draws)
//       burstDir    red 7 (body) / yellow 6 (wall)      -> parity twin + P2-A impact
//       burst       red 4|8 at the body centre          -> parity twin
//       healingSparkle 6 (a non-field block)            -> parity twin + P2-A shield contact
//     A PARITY TWIN is an invisible emitter built from the live emitter's own
//     config (the Bulwark field's precedent, systems/bulwarkCurtain.js): the
//     identical emission is performed into it and killed at once, so every
//     `Math.random` draw the shipped effect made is still made, in the same
//     order — the fight after a P2-A shot is the same fight. P2-A's own
//     scatter uses a private mulberry32 stream, never `Math.random`.
//     Casings, scorch decals, damage numbers, the enemy's hit flash, SFX,
//     sound propagation, the camera punch and hitstop are not touched.
//  4. One POST_UPDATE (after physics has synced the bodies and after P1 has
//     placed the weapon) draws everything from pooled objects. Ages advance by
//     `delta x time.timeScale`, so a hitstop or a slow-mo freezes the effects
//     with the world, and every shape is keyed to TIME and DISTANCE, never to
//     a frame count: density does not depend on the frame rate.

import Phaser from 'phaser';
import { isFxP2A } from './debug.js';
import { isLowQuality } from './FX.js';
import { mulberry32 } from './rng.js';
import { P1_WEAPONS } from './p1Paint.js';
import { P2A_TEX } from './p2aPaint.js';
import { WEAPONS } from '../config.js';

const TAU = Math.PI * 2;

/** Tuning. Lengths in px, times in ms. */
export const P2A = {
  pistol: {
    tail: 72,                 // light behind the head (~80ms of flight at 900px/s)
    tailTex: P2A_TEX.tailP, headTex: P2A_TEX.headP,
    headGlow: { tint: 0xff5a48, alpha: 0.30, scale: 0.85 },
    muzzle: { ms: 66, scale: 1.0, glow: { tint: 0xff5a40, alpha: 0.6, scale: 1.4 } },
  },
  rifle: {
    tail: 66,                 // thicker: a slug; bolts 70px apart in a burst, so the three heads chain without merging into a beam
    tailTex: P2A_TEX.tailR, headTex: P2A_TEX.headR,
    headGlow: { tint: 0xff4a3c, alpha: 0.28, scale: 0.85 },
    muzzle: { ms: 80, scale: 1.0, firstScale: 1.15, glow: { tint: 0xff4a30, alpha: 0.65, scale: 1.5 } },
    heat: { perShot: 1, max: 3, halfLifeMs: 90, tint: 0xff4020, alpha: 0.22, scale: 1.1 },
  },
  // contact flashes and their scatter
  body: { ms: 110, scale: 1.0, rifleScale: 1.15, glow: { tint: 0xff6a50, alpha: 0.45, scale: 1.1 }, sparks: 4, rifleSparks: 5, speed: [180, 360], life: [70, 130], cone: 0.7, color: [0xffffff, 0xffb080, 0xff4030] },
  armour: { sparks: 5, cone: 1.2 },
  wall: { ms: 120, scale: 1.0, rifleScale: 1.12, glow: { tint: 0xffc070, alpha: 0.5, scale: 1.0 }, sparks: 6, rifleSparks: 8, speed: [220, 460], life: [90, 170], cone: 0.75, gravity: 520, color: [0xffffff, 0xffe9a8, 0xffa040], ember: { ms: 260, tint: 0xff8030, alpha: 0.45, scale: 0.35 } },
  shield: { ms: 130, scale: 1.25, glow: { tint: 0x9fd4ff, alpha: 0.35, scale: 0.9 }, sparks: 4, speed: [160, 300], life: [80, 140], color: [0xffffff, 0xe6f6ff, 0x9fd4ff] },
  champion: { ms: 70, scale: 0.6 },   // the actor answers for itself; P2-A marks only the contact
  cap: { impacts: 14 },               // live contacts at once; the oldest is recycled (rate-independent clutter bound)
};

/** Install the P2-A layer on this GameScene run. No-op without the flag. */
export function installFxP2A(scene) {
  if (!isFxP2A() || !scene.player || !scene._p1Player || !scene.fx) return null;
  const ctl = new FxP2A(scene);
  scene._p2a = ctl;
  const step = (t, d) => ctl.update(t, d);
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, step);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, step);
    ctl.destroy();
    scene._p2a = null;
  });
  return ctl;
}

class FxP2A {
  constructor(scene) {
    this.scene = scene;
    this.fx = scene.fx;
    this.kinds = new Map([[scene.playerBullets, 'pistol'], [scene.playerRifleBullets, 'rifle']]);
    this.ctx = { fire: null, hit: null, wall: null, inHit: null, armour: false };
    this.bolts = [];           // live tracer records
    this.flashes = [];         // live muzzle flashes
    this.impacts = [];         // live contacts
    this.imgPool = [];
    this.gfxPool = [];
    this.twins = {};
    this.heat = 0;             // the rifle's barrel heat, 0..max
    this.heatGlow = null;
    this.burstIdx = 0;
    this._clock = 0;
    this._seq = 0;
    this.stats = { bolts: 0, impacts: { body: 0, armour: 0, wall: 0, shield: 0, champion: 0 }, parity: 0, recycled: 0, peakImpacts: 0 };
    this._tipCache = {};
    this._wrapped = [];
    this._install();
  }

  // ── install / uninstall ────────────────────────────────────────────────
  _wrap(obj, name, make) {
    const had = Object.prototype.hasOwnProperty.call(obj, name);
    const prev = obj[name];
    obj[name] = make(prev.bind(obj));
    this._wrapped.push(() => { if (had) obj[name] = prev; else delete obj[name]; });
  }

  _install() {
    const s = this.scene, fx = this.fx, C = this.ctx;
    // 1. the bolts: registered and hidden at fire
    for (const [g, kind] of this.kinds) {
      this._wrap(g, 'fire', (orig) => (...a) => {
        const b = orig(...a);
        if (b) this._onBolt(b, kind);
        return b;
      });
    }
    // 2. context flags around the shipped code
    this._wrap(s, 'firePlayerPrimary', (orig) => (a) => { C.fire = 'pistol'; try { return orig(a); } finally { C.fire = null; } });
    this._wrap(s, 'firePlayerRifle', (orig) => (a) => { C.fire = 'rifle'; try { return orig(a); } finally { C.fire = null; } });
    this._wrap(s, 'handleBulletEnemyHits', (orig) => (g, ...r) => {
      if (!this.kinds.has(g)) return orig(g, ...r);
      C.hit = g; try { return orig(g, ...r); } finally { C.hit = null; C.inHit = null; C.armour = false; }
    });
    this._wrap(s, 'handleBulletWallHits', (orig) => (g, ...r) => {
      if (!this.kinds.has(g)) return orig(g, ...r);
      C.wall = g; try { return orig(g, ...r); } finally { C.wall = null; }
    });
    this._wrap(s, '_impactMicroFlash', (orig) => (...a) => (C.wall ? undefined : orig(...a)));
    // 3. the shipped fx calls P2-A replaces, matched on their exact arguments
    this._wrap(fx, 'muzzleFlash', (orig) => (...a) => (C.fire ? this._onMuzzle(C.fire, a[0], a[1], a[2]) : orig(...a)));
    this._wrap(fx, 'hitFlash', (orig) => (spr) => {
      if (C.hit && spr && spr !== s.boss) C.inHit = spr;
      return orig(spr);
    });
    this._wrap(fx, 'impactRing', (orig) => (x, y, color, ...r) => {
      if (C.hit) {
        if (C.inHit && color === 0xffd8a0 && x === C.inHit.x && y === C.inHit.y) { C.armour = true; return; }
        if ((color === 0xee3030 || color === 0x50b0ff) && this._boltAt(C.hit, x, y)) return;
      }
      if (C.wall && color === 0xb0b0b0 && this._boltAt(C.wall, x, y)) return;
      return orig(x, y, color, ...r);
    });
    this._wrap(fx, 'burst', (orig) => (x, y, color, count) => {
      const e = C.inHit;
      if (C.hit && e && color === 'red' && (count === 4 || count === 8) && x === e.x && y === e.y) {
        this._parity('sparksRed', x, y, count, null);
        C.inHit = null;
        return;
      }
      return orig(x, y, color, count);
    });
    this._wrap(fx, 'burstDir', (orig) => (x, y, color, count, ang, spread) => {
      if (C.hit && color === 'red' && count === 7 && spread === 80) {
        const b = this._boltAt(C.hit, x, y);
        if (b) { this._parityDir('sparksRed', x, y, count, ang, spread); this._onBodyHit(b, ang, C.armour); C.armour = false; return; }
      }
      if (C.wall && color === 'yellow' && count === 6 && spread === 70) {
        const b = this._boltAt(C.wall, x, y);
        if (b) { this._parityDir('sparksYellow', x, y, count, ang, spread); this._onWallHit(b, ang - Math.PI); return; }
      }
      return orig(x, y, color, count, ang, spread);
    });
    this._wrap(fx, 'healingSparkle', (orig) => (x, y, count) => {
      if (C.hit && count === 6) {
        const b = this._boltAt(C.hit, x, y);
        if (b) { this._parity('sparksBlue', x, y, count, null); this._onShieldHit(b); return; }
      }
      return orig(x, y, count);
    });
    // the twins exist from the start, so a first contact costs nothing extra
    for (const k of ['sparksRed', 'sparksYellow', 'sparksBlue']) this._twin(k);
    this.heatGlow = s.add.image(0, 0, P2A_TEX.glow.key).setVisible(false);
  }

  destroy() {
    for (const u of this._wrapped.reverse()) u();
    this._wrapped = [];
    const all = [...this.imgPool, ...this.gfxPool, this.heatGlow, ...Object.values(this.twins)];
    for (const r of this.bolts) all.push(r.tail, r.head, r.glow);
    for (const f of this.flashes) all.push(f.img, f.glow);
    for (const m of this.impacts) all.push(m.img, m.glow, m.g, m.ember);
    for (const o of all) { try { o?.destroy(); } catch (_) { /* scene going down */ } }
    this.bolts = []; this.flashes = []; this.impacts = []; this.imgPool = []; this.gfxPool = [];
    this.twins = {}; this.heatGlow = null; this.scene = null; this.fx = null;
  }

  // ── pools ─────────────────────────────────────────────────────────────
  // Every P2-A object renders with the NORMAL blend — the glows included.
  // ADDITIVE glows looked a little more like light, but each one sits at its
  // own y-sorted depth among the actors, so every switch in and out of the
  // ADD blend broke the sprite batch: +4ms median per rendered frame in the
  // headless measurement, and exactly A's frame time with NORMAL glows
  // (diag-fx-p2a-perf --exp=noadd). A tinted soft sprite on a dark deck is
  // most of the look for none of the cost. (`add` is kept for the call sites.)
  _img(key, add = false) {   // eslint-disable-line no-unused-vars
    const o = this.imgPool.pop() || this.scene.add.image(0, 0, key);
    if (o.texture.key !== key) o.setTexture(key);
    o.setBlendMode(Phaser.BlendModes.NORMAL).setOrigin(0.5).setScale(1).setAlpha(1).setRotation(0).setFlipY(false).clearTint().setVisible(true);
    return o;
  }
  _gfx() { const g = this.gfxPool.pop() || this.scene.add.graphics(); g.clear(); g.setVisible(true).setAlpha(1).setPosition(0, 0); return g; }
  _free(o) { if (!o) return; o.setVisible(false); (o.type === 'Graphics' ? this.gfxPool : this.imgPool).push(o); }

  // ── RNG parity ──────────────────────────────────────────────────────────
  _twin(name) {
    let t = this.twins[name];
    if (!t) {
      const src = this.fx[name];
      t = this.twins[name] = this.scene.add.particles(0, 0, src.texture.key, src.config).setVisible(false);
    }
    return t;
  }
  _parity(name, x, y, count) {
    const t = this._twin(name);
    t.ops.angle.onChange({ min: 0, max: 360 });
    t.emitParticleAt(x, y, count);
    t.killAll();
    this.stats.parity += count;
  }
  _parityDir(name, x, y, count, ang, spread) {
    const t = this._twin(name);
    const cx = Phaser.Math.RadToDeg(ang);
    t.ops.angle.onChange({ min: cx - spread / 2, max: cx + spread / 2 });
    t.emitParticleAt(x, y, count);
    t.killAll();
    this.stats.parity += count;
  }

  // ── geometry ────────────────────────────────────────────────────────────
  _boltAt(group, x, y) {
    for (const b of group.getChildren()) if (b.active && b.x === x && b.y === y) return b;
    return null;
  }
  _rec(b) { for (const r of this.bolts) if (r.b === b && r.gen === b._gen && !r.dead) return r; return null; }
  /** px from the P1 weapon's origin to its muzzle face along +x (read once from the texture). */
  _tip(key) {
    if (this._tipCache[key] != null) return this._tipCache[key];
    const tex = this.scene.textures.get(key), src = tex.getSourceImage();
    const cv = document.createElement('canvas'); cv.width = src.width; cv.height = src.height;
    const c2 = cv.getContext('2d'); c2.drawImage(src, 0, 0);
    const d = c2.getImageData(0, 0, cv.width, cv.height).data;
    let right = 0;
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
      const i = (y * cv.width + x) * 4;
      if (d[i + 3] > 0 && !(d[i] === 6 && d[i + 1] === 7 && d[i + 2] === 10)) right = Math.max(right, x + 1);
    }
    const spec = /rifle/.test(key) ? P1_WEAPONS.rifle : P1_WEAPONS.pistol;
    return (this._tipCache[key] = right - spec.origin[0] * src.width);
  }
  /** The live muzzle face of the P1 weapon, or null when it is not a gun this frame. */
  _muzzle() {
    const w = this.scene._p1Player?.weapon;
    if (!w || !/^p1-(pistol|rifle)/.test(w.texture.key)) return null;
    const d = this._tip(w.texture.key);
    return { x: w.x + Math.cos(w.rotation) * d, y: w.y + Math.sin(w.rotation) * d, rot: w.rotation, flip: w.flipY, depth: w.depth, alpha: w.alpha };
  }
  _rand(seed) { return mulberry32(((++this._seq) * 0x9e3779b1 + seed) >>> 0); }

  // ── 1. FIRE ─────────────────────────────────────────────────────────────
  _onBolt(b, kind) {
    b.setVisible(false);
    const P = this.scene.player, cfg = P2A[kind];
    const ang = Math.atan2(b.body.velocity.y, b.body.velocity.x);
    // the barrel face this shot leaves from, at the moment of firing: the P1
    // hold (reach + tip) less the recoil kick the shot has just set
    const spec = kind === 'rifle' ? P1_WEAPONS.rifle : P1_WEAPONS.pistol;
    const kick = P._wKickT > 0 ? Phaser.Math.Clamp(P._wKickT / (P._wKickDur || 80), 0, 1) * (P._wKickMag || 0) : 0;
    const face = spec.reach + this._tip(spec.key) - kick;
    const ox = P.x + Math.cos(ang) * face, oy = P.y + Math.sin(ang) * face;
    const r = {
      b, gen: b._gen, kind, cfg, ox, oy, ang, speed: Math.hypot(b.body.velocity.x, b.body.velocity.y),
      x: b.x, y: b.y, lastAlong: 0, dead: false, endX: 0, endY: 0, endAlong: 0, tLen: 0, back: 0, contact: null, fade: 0,
      tail: this._img(cfg.tailTex.key).setOrigin(1, 0.5).setVisible(false),
      head: this._img(cfg.headTex.key).setOrigin(cfg.headTex.ox, 0.5).setVisible(false),
      glow: isLowQuality() ? null : this._img(P2A_TEX.glow.key, true).setTint(cfg.headGlow.tint).setVisible(false),
    };
    this.bolts.push(r);
    this.stats.bolts++;
  }

  _onMuzzle(kind, x, y, angle) {
    const cfg = P2A[kind].muzzle;
    let tex = P2A_TEX.mzP.key, ox = P2A_TEX.mzP.ox, scale = cfg.scale;
    if (kind === 'rifle') {
      // which shot of the burst this is (the counter decrements after the shot)
      const P = this.scene.player;
      this.burstIdx = Math.max(0, WEAPONS.rifle.burstCount - (P._burstRemaining || WEAPONS.rifle.burstCount));
      tex = P2A_TEX.mzR.keys[this.burstIdx % 2]; ox = P2A_TEX.mzR.ox;
      if (this.burstIdx === 0) scale = cfg.firstScale;
      const H = P2A.rifle.heat;
      this.heat = Math.min(H.max, this.heat + H.perShot);
    }
    const f = { kind, age: 0, ms: cfg.ms, scale, x, y, angle, img: this._img(tex).setOrigin(ox, 0.5), glow: isLowQuality() ? null : this._img(P2A_TEX.glow.key, true).setTint(cfg.glow.tint) };
    this.flashes.push(f);
    this._drawFlash(f);
  }

  // ── 2. CONTACT ──────────────────────────────────────────────────────────
  _impact(kind, x, y, rot, opt = {}) {
    if (this.impacts.length >= P2A.cap.impacts) { this._freeImpact(this.impacts.shift()); this.stats.recycled++; }
    const T = { body: P2A_TEX.hitBody, armour: P2A_TEX.hitArmour, wall: P2A_TEX.hitWall, shield: P2A_TEX.hitShield, champion: P2A_TEX.hitBody }[kind];
    const C = kind === 'armour' || kind === 'champion' ? P2A.body : P2A[kind];
    const low = isLowQuality();
    const m = {
      kind, x, y, sx: x, sy: y, rot, age: 0, ms: kind === 'champion' ? P2A.champion.ms : C.ms, depth: opt.depth ?? y + 40, rifle: !!opt.rifle,
      // a contact on an actor RIDES him: during collision handling the
      // sprites still stand where the previous physics step left them (their
      // bodies have moved on), and a struck body staggers; an offset re-applied
      // each frame keeps the flash on the rim the player sees. The scatter
      // stays where it was thrown (sx, sy).
      follow: opt.follow || null, fx: opt.follow ? x - opt.follow.x : 0, fy: opt.follow ? y - opt.follow.y : 0, dz: opt.follow ? (opt.depth ?? 0) - (opt.follow.depth ?? 0) : 0,
      scale: (kind === 'champion' ? P2A.champion.scale : (opt.rifle ? (C.rifleScale || 1.1) : C.scale)),
      img: this._img(T.key).setOrigin(T.ox, 0.5),
      glow: low || kind === 'champion' ? null : this._img(P2A_TEX.glow.key, true).setTint(C.glow.tint),
      g: null, sparks: null, ember: null,
    };
    // the scatter: a fixed count per contact from a private stream (never Math.random)
    const n = low || kind === 'champion' ? 0
      : kind === 'wall' ? (opt.rifle ? C.rifleSparks : C.sparks)
        : kind === 'armour' ? P2A.armour.sparks
          : kind === 'shield' ? C.sparks : (opt.rifle ? C.rifleSparks : C.sparks);
    if (n > 0) {
      const R = this._rand(Math.round(x * 31 + y * 17));
      const S = kind === 'armour' ? P2A.body : C;
      m.sparks = [];
      for (let i = 0; i < n; i++) {
        let a;
        if (opt.dirs) a = opt.dirs(i, n, R);
        else a = rot + (R() - 0.5) * 2 * (kind === 'armour' ? P2A.armour.cone : S.cone);
        m.sparks.push({ a, v: S.speed[0] + R() * (S.speed[1] - S.speed[0]), life: S.life[0] + R() * (S.life[1] - S.life[0]), delay: R() * 18, w: R() < 0.35 ? 3 : 2 });
      }
      m.g = this._gfx();
    }
    if (kind === 'wall' && !low) m.ember = this._img(P2A_TEX.glow.key, true).setTint(P2A.wall.ember.tint);
    this.impacts.push(m);
    this.stats.impacts[kind]++;
    this.stats.peakImpacts = Math.max(this.stats.peakImpacts, this.impacts.length);
    this._drawImpact(m);
    return m;
  }

  _onBodyHit(b, flightAng, armour) {
    const r = this._rec(b);
    let e = null; for (const v of b.hitSet) e = v;
    if (!e) return;
    // where the flight line meets the body circle: the bolt's 30px hitbox
    // registers the hit up to ~30px early, so the bolt's centre can still be
    // in the air in front of him
    const rad = e.cfg?.radius ?? 22;
    const c = circleEntry(b.x, b.y, flightAng, e.x, e.y, rad);
    const kind = e.isChampion ? 'champion' : (armour ? 'armour' : 'body');
    const m = this._impact(kind, c.x, c.y, flightAng, { rifle: r?.kind === 'rifle', depth: (e.depth ?? e.y) + 4, follow: e });
    if (r) r.contact = m;
  }

  _onWallHit(b, flightAng) {
    const r = this._rec(b);
    const w = this._wallAt(b.x, b.y);
    let cx = b.x, cy = b.y, nx = -Math.cos(flightAng), ny = -Math.sin(flightAng), depth = b.y + 60;
    if (w) {
      const hit = aabbEntry(b.x, b.y, flightAng, w.cx, w.cy, w.hw, w.hh);
      cx = hit.x; cy = hit.y; nx = hit.nx; ny = hit.ny; depth = w.depth + 1;
    }
    const n = Math.atan2(ny, nx);
    // the ricochet: the flight reflected off the face, plus two along it
    const dx = Math.cos(flightAng), dy = Math.sin(flightAng), dot = dx * nx + dy * ny;
    const rx = dx - 2 * dot * nx, ry = dy - 2 * dot * ny, refl = Math.atan2(ry, rx);
    const cone = P2A.wall.cone;
    this._impact('wall', cx, cy, n, {
      rifle: r?.kind === 'rifle', depth,
      dirs: (i, k, R) => (i < k - 2 ? refl + (R() - 0.5) * 2 * cone : n + (i === k - 2 ? 1 : -1) * (Math.PI / 2 - 0.25 - R() * 0.3)),
    });
    if (r) r.contact = { x: cx, y: cy };
  }

  _onShieldHit(b) {
    const r = this._rec(b);
    let e = null; for (const v of b.hitSet) e = v;
    if (!e) return;
    const ang = Math.atan2(b.body.velocity.y, b.body.velocity.x);
    // the legacy arc's own radius (Enemy.js: cfg.radius + 14), on the flight line
    const R = (e.cfg?.radius ?? 22) + 14;
    const c = circleEntry(b.x, b.y, ang, e.x, e.y, R);
    const n = Math.atan2(c.y - e.y, c.x - e.x);
    const t = n + Math.PI / 2;
    const m = this._impact('shield', c.x, c.y, n, {
      depth: (e.depth ?? e.y) + 3, follow: e,
      // glancing: along the surface both ways, and one back out
      dirs: (i, k, R) => (i === 0 ? n + (R() - 0.5) * 0.5 : (i % 2 ? t : t + Math.PI) + (R() - 0.5) * 0.6 + (i % 2 ? -0.25 : 0.25)),
    });
    if (r) r.contact = m;
  }

  _wallAt(x, y) {
    for (const w of this.scene.walls.getChildren()) {
      if (!w.active) continue;
      const wb = w.body;
      const hw = (wb ? wb.width : w.displayWidth) / 2, hh = (wb ? wb.height : w.displayHeight) / 2;
      const cx = wb ? wb.x + wb.width / 2 : w.x, cy = wb ? wb.y + wb.height / 2 : w.y;
      if (Math.abs(x - cx) < hw && Math.abs(y - cy) < hh) return { cx, cy, hw, hh, depth: w.depth };
    }
    return null;
  }

  /** The end of a bolt that died with no contact P2-A drew: a field block, range, a boss. */
  _endOf(r) {
    const b = r.b, s = this.scene;
    if (b._gen === r.gen) {
      for (const e of s.enemies.getChildren()) {
        if (!e.active || !e._curtain || !b.hitSet.has(e)) continue;
        // a roster-v1 Bulwark's field took it: the field draws the block; the
        // tracer only ends on its surface, where the game says it crossed
        const c = s._curtainContact?.(e, b, r.ang);
        if (c) return { x: c.x, y: c.y, hit: true };
      }
      return { x: b.x, y: b.y, hit: false };
    }
    return { x: r.x, y: r.y, hit: false };
  }

  // ── 3. THE FRAME ────────────────────────────────────────────────────────
  update(time, delta) {
    if (!this.scene) return;
    const dt = delta * (this.scene.time.timeScale ?? 1);
    this._clock += dt;
    // contacts first: a contact riding its target is placed before a dying
    // tracer reads it as its end point
    this._updateImpacts(dt);
    this._updateBolts(dt);
    this._updateFlashes(dt);
  }

  _updateBolts(dt) {
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const r = this.bolts[i], b = r.b, cfg = r.cfg;
      const alive = b.active && b._gen === r.gen;
      if (alive) {
        if (b.visible) b.setVisible(false);
        r.ang = Math.atan2(b.body.velocity.y, b.body.velocity.x);
        r.x = b.x; r.y = b.y;
        r.lastAlong = (b.x - r.ox) * Math.cos(r.ang) + (b.y - r.oy) * Math.sin(r.ang);
        this._drawBolt(r, b.x, b.y, Math.min(cfg.tail, r.lastAlong), true, 1);
        continue;
      }
      if (!r.dead) {
        // died this frame: a contact P2-A drew, a field block, the range, a boss
        r.dead = true;
        const end = r.contact || this._endOf(r);
        r.endX = end.x; r.endY = end.y;
        r.endAlong = (end.x - r.ox) * Math.cos(r.ang) + (end.y - r.oy) * Math.sin(r.ang);
        r.tLen = Math.max(0, Math.min(cfg.tail, r.endAlong));
        r.back = 0;
        r.hit = !!r.contact || !!end.hit;
        r.head.setVisible(false); r.glow?.setVisible(false);
      }
      // MOTION PERSISTENCE: the light already in flight keeps going and runs
      // into the end point — the tail's back end advances at the bolt's speed
      // until it arrives. A miss at range simply drains; nothing flashes.
      if (r.contact?.follow) { r.endX = r.contact.x; r.endY = r.contact.y; }
      r.back += r.speed * dt / 1000;
      const L = r.tLen - r.back;
      if (L <= 0.5) { this._freeBolt(r); this.bolts.splice(i, 1); continue; }
      this._drawBolt(r, r.endX, r.endY, L, false, r.hit ? 1 : Math.max(0, L / Math.max(1, r.tLen)));
    }
  }

  _drawBolt(r, hx, hy, L, live, alpha) {
    const cfg = r.cfg;
    const depth = hy + 3;
    if (L <= 1) { r.tail.setVisible(false); r.head.setVisible(false); r.glow?.setVisible(false); return; }
    r.tail.setVisible(true).setPosition(hx, hy).setRotation(r.ang).setScale(L / cfg.tailTex.w, 1).setDepth(depth).setAlpha(alpha);
    if (live) {
      r.head.setVisible(true).setPosition(hx, hy).setRotation(r.ang).setDepth(depth + 0.1);
      if (r.glow) r.glow.setVisible(true).setPosition(hx, hy).setScale(cfg.headGlow.scale).setAlpha(cfg.headGlow.alpha).setDepth(depth + 0.05);
    }
  }
  _freeBolt(r) { this._free(r.tail); this._free(r.head); this._free(r.glow); }

  _updateFlashes(dt) {
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.age += dt;
      if (f.age >= f.ms) { this._free(f.img); this._free(f.glow); this.flashes.splice(i, 1); continue; }
      this._drawFlash(f);
    }
    // the rifle's barrel heat: builds with each shot of a burst, bleeds off after
    const H = P2A.rifle.heat;
    this.heat *= Math.pow(0.5, dt / H.halfLifeMs);
    const mz = this._muzzle();
    if (this.heat > 0.05 && mz && !isLowQuality() && /rifle/.test(this.scene._p1Player?.weapon?.texture?.key || '')) {
      this.heatGlow.setVisible(true).setPosition(mz.x, mz.y).setTint(H.tint).setScale(H.scale * (0.7 + 0.3 * this.heat / H.max))
        .setAlpha(mz.alpha * H.alpha * Math.min(1, this.heat)).setDepth(mz.depth + 0.4);
    } else if (this.heatGlow.visible) this.heatGlow.setVisible(false);
  }

  _drawFlash(f) {
    // pinned to the LIVE barrel face — it rides the recoil and the hero's
    // step for its few frames — and drawn just over the weapon, behind him
    // when the weapon is (facing north)
    const mz = this._muzzle();
    const cfg = P2A[f.kind].muzzle;
    if (!mz) { f.img.setVisible(false); f.glow?.setVisible(false); return; }
    const u = f.age / f.ms;
    // ignition: full size for the first ~third, then the flare is pulled back
    // into the barrel (x shrinks faster than y) and goes
    const sx = f.scale * (u < 0.3 ? 1 : 1 - 0.75 * ((u - 0.3) / 0.7));
    const sy = f.scale * (u < 0.3 ? 1 : 1 - 0.45 * ((u - 0.3) / 0.7));
    const a = mz.alpha * (u < 0.3 ? 1 : 1 - (u - 0.3) / 0.7);
    f.img.setVisible(true).setPosition(mz.x, mz.y).setRotation(mz.rot).setFlipY(mz.flip).setScale(sx, sy).setAlpha(a).setDepth(mz.depth + 0.5);
    if (f.glow) f.glow.setVisible(true).setPosition(mz.x, mz.y).setScale(cfg.glow.scale * (1 + 0.3 * u)).setAlpha(mz.alpha * cfg.glow.alpha * (1 - u) * (1 - u)).setDepth(mz.depth + 0.45);
  }

  _updateImpacts(dt) {
    for (let i = this.impacts.length - 1; i >= 0; i--) {
      const m = this.impacts[i];
      m.age += dt;
      const end = Math.max(m.ms, m.ember ? P2A.wall.ember.ms : 0, m.sparks ? Math.max(...m.sparks.map((s) => s.delay + s.life)) : 0);
      if (m.age >= end) { this._freeImpact(m); this.impacts.splice(i, 1); continue; }
      this._drawImpact(m);
    }
  }

  _drawImpact(m) {
    const f = m.follow;
    if (f && f.active) { m.x = f.x + m.fx; m.y = f.y + m.fy; m.depth = (f.depth ?? f.y) + m.dz; }
    const u = Math.min(1, m.age / m.ms);
    const C = m.kind === 'armour' || m.kind === 'champion' ? P2A.body : P2A[m.kind];
    // the contact: a hard flash for the first ~two frames, then it collapses
    if (u < 1) {
      const pop = u < 0.25 ? 1 + 0.15 * (u / 0.25) : 1.15 - 0.55 * ((u - 0.25) / 0.75);
      const a = u < 0.35 ? 1 : 1 - (u - 0.35) / 0.65;
      m.img.setVisible(true).setPosition(m.x, m.y).setRotation(m.rot).setScale(m.scale * pop).setAlpha(a).setDepth(m.depth);
      if (m.glow) m.glow.setVisible(true).setPosition(m.x, m.y).setScale(C.glow.scale * m.scale * (0.8 + 0.4 * u)).setAlpha(C.glow.alpha * (1 - u) * (1 - u)).setDepth(m.depth - 0.05);
    } else { m.img.setVisible(false); m.glow?.setVisible(false); }
    // hot metal: a small ember on the face that cools after the flash
    if (m.ember) {
      const E = P2A.wall.ember, v = m.age / E.ms;
      if (v < 1) m.ember.setVisible(true).setPosition(m.x, m.y).setScale(E.scale).setAlpha(E.alpha * (1 - v)).setDepth(m.depth - 0.1);
      else m.ember.setVisible(false);
    }
    // the scatter: short streaks whose length is their speed (motion, not dots)
    if (m.g) {
      const g = m.g, cols = C.color, grav = m.kind === 'wall' ? P2A.wall.gravity : 0;
      g.clear().setDepth(m.depth + 0.1);
      for (const s of m.sparks) {
        const t = m.age - s.delay;
        if (t < 0 || t > s.life) continue;
        const p = t / s.life, ts = t / 1000;
        const ca = Math.cos(s.a), sa = Math.sin(s.a);
        const v = s.v * (1 - 0.5 * p);
        const px = m.sx + ca * s.v * ts * (1 - 0.25 * p), py = m.sy + sa * s.v * ts * (1 - 0.25 * p) + 0.5 * grav * ts * ts;
        const len = Math.max(3, v * 0.035);
        const col = p < 0.3 ? cols[0] : p < 0.65 ? cols[1] : cols[2];
        g.lineStyle(s.w, col, 1 - p * p);
        g.lineBetween(px - ca * len, py - sa * len - grav * ts * 0.03, px, py);
      }
    }
  }

  _freeImpact(m) { this._free(m.img); this._free(m.glow); this._free(m.ember); if (m.g) { m.g.clear(); this._free(m.g); } }
}

// ── pure geometry (presentation only: it reads numbers it is handed) ───────
/** Where a line along `ang` through (bx,by) meets the circle (cx,cy,R): the
 *  entry nearest the shooter; the closest rim point when the line misses. */
export function circleEntry(bx, by, ang, cx, cy, R) {
  const dx = Math.cos(ang), dy = Math.sin(ang);
  const px = bx - cx, py = by - cy;
  const b = px * dx + py * dy, c = px * px + py * py - R * R, disc = b * b - c;
  if (disc >= 0) {
    const t = -b - Math.sqrt(disc);              // the first crossing along the flight
    return { x: bx + dx * t, y: by + dy * t };
  }
  // grazing: the rim point under the line's closest approach
  const qx = px - dx * b, qy = py - dy * b, q = Math.hypot(qx, qy) || 1;
  return { x: cx + (qx / q) * R, y: cy + (qy / q) * R };
}

/** Back along the flight from a point inside an AABB to the face it entered
 *  through, and that face's outward normal. */
export function aabbEntry(bx, by, ang, cx, cy, hw, hh) {
  const dx = Math.cos(ang), dy = Math.sin(ang);
  const tx = dx > 1e-6 ? (bx - (cx - hw)) / dx : dx < -1e-6 ? (bx - (cx + hw)) / dx : Infinity;
  const ty = dy > 1e-6 ? (by - (cy - hh)) / dy : dy < -1e-6 ? (by - (cy + hh)) / dy : Infinity;
  if (tx <= ty) return { x: bx - dx * tx, y: by - dy * tx, nx: -Math.sign(dx), ny: 0 };
  return { x: bx - dx * ty, y: by - dy * ty, nx: 0, ny: -Math.sign(dy) };
}
