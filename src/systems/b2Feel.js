// B2-1 — THE WEAPON PRESENTATION LAYER (opt-in with `?b2=`; HUMAN-authorized
// to depart from the frozen P2-A3 / P1 / V2C presentation WHILE THE FLAG IS ON.
// Without the flag nothing here is installed and those configurations are
// byte-identical).
//
// It follows the seam P2-A proved (systems/p2aFx.js): the round is an ordinary
// hidden `playerBullets` collider, and everything the eye sees is drawn from
// pooled objects in ONE post-update, keyed to time and distance. What is new:
//
//  ONE INTENSITY VALUE. The Super charge (0..1) drives the tracer's length
//  and colour, the muzzle, the light it throws on the floor, the ember on the
//  barrel and (systems/b2Voice.js) the pitch of the shot: THE GUN IS THE
//  METER. Cold is the hero's own bolt red; it climbs through orange and amber
//  to white-gold; PRIMED adds a cyan rim, the hero's own colour, so "full" is
//  a different thing from "hot".
//
//  A STREAM, NOT DOTS. A streak is as long as ~65% of the gap between rounds,
//  every fourth round is a brighter tracer, and a streak that ends on a body
//  runs INTO the contact instead of vanishing.
//
//  LIGHT, NOT PARTICLES. The muzzle and every contact throw an additive spill
//  on the floor (the emitter + spill idea of systems/EnvLight.js).
//
//  A HIT HIERARCHY. The first round on a target gets the shipped white flash;
//  rounds inside the next 320ms get a warm tint, so an enemy under a stream
//  stays readable. Damage numbers ROLL UP per target; the generic ring, spark
//  and beep the single-shot pistol used are not drawn per round.
//
// Deterministic: no `Math.random`; variation is fixed rotations.
import Phaser from 'phaser';
import { PLAYER } from '../config.js';
import { isLowQuality, SFX } from './FX.js';
import { PixelCanvas } from './pixelArt.js';
import { P1_WEAPONS } from './p1Paint.js';
import { circleEntry } from './p2aFx.js';
import { isB2Debug } from './debug.js';
import { createTemperSkin, tipStep } from './b2Temper.js';
import { createReactorSkin } from './b2Reactor.js';

const TEX = { core: 'b2-core', trail: 'b2-trail', body: 'b2-body', head: 'b2-head', halo: 'b2-halo', spill: 'b2-spill', mz: ['b2-mz0', 'b2-mz1', 'b2-mz2'], spark: 'b2-spark', ring: 'b2-ring' };
const FLICK = [1, 0.86, 1.1, 0.93, 1.04];
const RAMP = [[0, 0xff3a2c], [0.4, 0xff6a24], [0.75, 0xffb030], [1, 0xffe9a8]];
const CYAN = 0x9fefff;

const lerpInt = (a, b, t) => {
  const r = ((a >> 16) & 255) + ((((b >> 16) & 255) - ((a >> 16) & 255)) * t);
  const g = ((a >> 8) & 255) + ((((b >> 8) & 255) - ((a >> 8) & 255)) * t);
  const bl = (a & 255) + (((b & 255) - (a & 255)) * t);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
};
/** The charge colour: 0 = the hero's bolt red, 1 = white-gold. */
export function b2HeatColor(c) {
  c = Phaser.Math.Clamp(c, 0, 1);
  for (let i = 1; i < RAMP.length; i++) if (c <= RAMP[i][0]) return lerpInt(RAMP[i - 1][1], RAMP[i][1], (c - RAMP[i - 1][0]) / (RAMP[i][0] - RAMP[i - 1][0]));
  return RAMP[RAMP.length - 1][1];
}
const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;

// ── textures (painted once per game; white, tinted at run time) ───────────
function paint(scene) {
  if (scene.textures.exists(TEX.core)) return;
  const a = (v) => `rgba(255,255,255,${Math.max(0, Math.min(1, v)).toFixed(3)})`;
  // the hot core: one row, fading to the tail
  let c = new PixelCanvas(scene, TEX.core, 24, 1, 3);
  for (let x = 0; x < 24; x++) c.px(x, 0, a(0.45 + 0.55 * Math.pow((x + 1) / 24, 1.3)));
  c.finish();
  // the solid coloured body: three rows that taper to a point, so the streak
  // reads on any floor (an additive red over grey metal is nearly invisible)
  c = new PixelCanvas(scene, TEX.body, 24, 3, 3);
  for (let x = 0; x < 24; x++) {
    const t = (x + 1) / 24;
    for (let y = 0; y < 3; y++) {
      const rim = y !== 1;
      if (rim && t < 0.3) continue;
      c.px(x, y, a((rim ? 0.72 : 1) * (0.5 + 0.5 * t)));
    }
  }
  c.finish();
  // the glow round it: seven rows, additive
  c = new PixelCanvas(scene, TEX.trail, 24, 7, 3);
  for (let x = 0; x < 24; x++) {
    const t = (x + 1) / 24;
    for (let y = 0; y < 7; y++) {
      const d = Math.abs(y - 3) / 3;
      const start = 0.04 + 0.5 * d;
      if (t < start) continue;
      const u = (t - start) / (1 - start);
      c.px(x, y, a((d === 0 ? 0.9 : d < 0.4 ? 0.7 : d < 0.7 ? 0.42 : 0.2) * (0.3 + 0.7 * u)));
    }
  }
  c.finish();
  // the head: a short hard capsule along the flight (origin at its centre)
  c = new PixelCanvas(scene, TEX.head, 7, 3, 3);
  for (let y = 0; y < 3; y++) for (let x = 0; x < 7; x++) { if (y !== 1 && (x === 0 || x === 6)) continue; c.px(x, y, a(y === 1 ? 1 : 0.85)); }
  c.finish();
  // halo and floor spill: stepped radial falloff (pixel light, not a blur)
  const radial = (key, n, scale, steps, peak, pow) => {
    const cv = new PixelCanvas(scene, key, n, n, scale);
    const m = (n - 1) / 2;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const r = Math.hypot(x - m, y - m) / m;
      if (r > 1) continue;
      const v = Math.ceil(Math.pow(1 - r, pow) * steps) / steps;
      if (v > 0) cv.px(x, y, a(v * peak));
    }
    cv.finish();
  };
  radial(TEX.halo, 15, 3, 5, 0.85, 1.5);
  radial(TEX.spill, 41, 2, 7, 0.6, 1.25);
  // muzzle flashes: +x is the bore; origin at the left edge centre
  const MZ = [
    ['....#......', '..####.....', '.########..', '###########', '.########..', '..####.....', '....#......'],
    ['...#.......', '..###..#...', '.#######...', '##########.', '.#######...', '..###..#...', '...#.......'],
    ['.....#.....', '..#####....', '.#########.', '###########', '.#########.', '..#####....', '.....#.....'],
  ];
  MZ.forEach((rows, i) => {
    const cv = new PixelCanvas(scene, TEX.mz[i], 11, 7, 3);
    rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') cv.px(x, y, a(y === 3 ? 1 : Math.abs(y - 3) === 1 ? 0.9 : 0.6)); }));
    cv.finish();
  });
  // the contact: a splash thrown forward along the flight; origin at its left centre
  c = new PixelCanvas(scene, TEX.spark, 9, 7, 3);
  ['#........', '.##...#..', '..####...', '.#######.', '..####...', '.##...#..', '#........'].forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') c.px(x, y, a(y === 3 ? 1 : 0.8)); }));
  c.finish();
  // the primed rim: a one-pixel ring
  c = new PixelCanvas(scene, TEX.ring, 13, 13, 3);
  for (let y = 0; y < 13; y++) for (let x = 0; x < 13; x++) { const r = Math.hypot(x - 6, y - 6); if (r >= 4.6 && r <= 5.6) c.px(x, y, a(0.9)); }
  c.finish();
}

export function installB2Feel(scene, api, K, voice) {
  if (!scene?.add || !scene.fx) return null;
  paint(scene);
  // THE CLOSURE CANDIDATE (`&b2c=1`). The HUMAN judged the charge progression ("thin red
  // strips into bright white firework-like effects") weak. Under the candidate the bolt keeps
  // ONE identity (the hero's warm red, cold), the white-gold ramp, the halos, the orange impact
  // pools and the primed rim are gone, and the charge is carried by a cool ice-white THREAD
  // inside each bolt whose length is the Super charge when it was fired, plus a ring pulse at
  // the barrel at each quarter of the meter. FULL belongs to the approved P1-B ring alone.
  // TEMPER (`&b2t=1`, systems/b2Temper.js): a SKIN that draws the round, the muzzle, the
  // contact, the gun and the Super. This file keeps the round's lifecycle and the tracer
  // invariant; with the skin on, the B2-1 and closure-candidate drawing below is not used.
  let skin = null;
  const cand = () => !!api.candidate && !skin;
  // THREAD is the P1-B charging gauge's own lit colour, so the gun and the gauge share a hue
  const COLD = b2HeatColor(0.12), THREAD = 0xa9c4ee, STEP = 0xeef8ff;
  const tone = (heat) => (cand() ? COLD : b2HeatColor(heat));
  const fx = scene.fx;
  const low = () => isLowQuality();
  // THE TRACER INVARIANT, checked on every visible streak every frame: it lies on its own
  // origin -> collider line, never reaches behind the barrel, its live head IS the collider,
  // and a finished streak ends where its collider actually stopped (or, for a body hit, at
  // that body). `bad` counts frames x streaks that break it; `samples` keeps the first few.
  const inv = { checks: 0, bad: 0, samples: [], maxOff: 0, maxEndErr: 0 };
  const stats = { inv, ends: {}, staleContacts: 0, rounds: 0, contacts: 0, flashesFull: 0, flashesSoft: 0, numbersIn: 0, numbersOut: 0, peakRounds: 0, peakObjects: 0, updN: 0, updMs: 0, updMax: 0, dropped: { ring: 0, burst: 0, beep: 0 } };

  // ── pools ───────────────────────────────────────────────────────────────
  const pool = [];
  let made = 0, out = 0;
  const img = (key, add) => {
    const o = pool.pop() || (made++, scene.add.image(0, 0, key));
    if (o.texture.key !== key) o.setTexture(key);
    o.setBlendMode(add ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL).setOrigin(0.5).setScale(1).setAlpha(1).setRotation(0).clearTint().setVisible(true);
    out++; if (out > stats.peakObjects) stats.peakObjects = out;
    return o;
  };
  const free = (o) => { if (!o) return; o.setVisible(false); pool.push(o); out--; };

  // ── geometry: where the barrel ends ─────────────────────────────────────
  const tipLen = () => {
    const p2a = scene._p2a;
    if (p2a?._tip) { try { return P1_WEAPONS.rifle.reach + p2a._tip(P1_WEAPONS.rifle.key); } catch (_) { /* */ } }
    return PLAYER.radius + 12;
  };
  let face = null;
  const muzzleNow = (p, ang) => {
    // The live weapon when P2-A is drawing one (it carries the kick and the
    // hold), otherwise the gameplay muzzle.
    const m = scene._p2a?._muzzle?.();
    if (m) return m;
    if (face == null) face = tipLen();
    return { x: p.x + Math.cos(ang) * face, y: p.y + Math.sin(ang) * face, rot: ang, depth: p.depth + 2, alpha: 1 };
  };

  // ── rounds ──────────────────────────────────────────────────────────────
  const recs = [];       // { r, ox, oy, ang, heat, len, trail, core, head, halo, dead, back, endX, endY, tLen, speed }
  const flashes = [];    // muzzle flashes
  const sparks = [];     // contacts
  let lastShotClock = -1e9, lastDir = 0, shotN = 0, clockNow = 0, primedAt = -1e9, superAt = -1e9, hotFlashAt = -1e9;
  // bullet -> { x, y, r, gen } of the body contact B2 drew for it. THE BULLET IS POOLED: the same
  // object carries round after round, so a contact belongs to ONE generation (`b._gen` at the
  // hit), is cleared when a new round is fired from that bullet, and is consumed when its own
  // round ends. Keyed by the bullet alone (the shipped B2-1 code) a recycled bullet that then
  // missed ended its streak at its PREVIOUS life's enemy contact — a full-bright streak drawn
  // at an old kill site, along the new round's heading: the detached tracers in the HUMAN's
  // firing-range recording.
  const contactOf = new WeakMap();
  const wallEnd = new WeakMap();      // bullet -> the generation a wall stopped

  function onRound(rec, p) {
    stats.rounds++;
    // a contact left on this pooled bullet by its previous round: not this round's
    if (contactOf.delete(rec.b)) stats.staleContacts++;
    if (face == null) face = tipLen();
    const ang = rec.ang;
    const ox = p.x + Math.cos(ang) * face, oy = p.y + Math.sin(ang) * face;
    if (skin) {
      const sv = { r: rec, ox, oy, ang, heat: rec.heat, len: skin.boltLen, speed: K.speed, dead: false, back: 0 };
      skin.roundNew(sv, rec);
      recs.push(sv);
      if (recs.length > stats.peakRounds) stats.peakRounds = recs.length;
      skin.flashNew(rec, ang);
      lastShotClock = clockNow; lastDir = ang; shotN = rec.n;
      return;
    }
    const heat = cand() ? 0 : Math.min(1, rec.heat + (rec.hot ? 0.35 : 0));
    const col = tone(heat);
    const len = cand() ? 84 * (rec.accent ? 1.15 : 1) : (78 + 20 * heat) * (rec.accent ? 1.2 : 1);
    const v = {
      r: rec, ox, oy, ang, heat, col, len, speed: K.speed, dead: false, back: 0,
      trail: low() ? null : img(TEX.trail, true).setOrigin(1, 0.5).setTint(col).setVisible(false),
      body: img(TEX.body, false).setOrigin(1, 0.5).setTint(lerpInt(col, 0xffffff, 0.18)).setVisible(false),
      core: img(TEX.core, false).setOrigin(1, 0.5).setTint(lerpInt(col, 0xffffff, 0.8)).setVisible(false),
      head: img(TEX.head, false).setTint(lerpInt(col, 0xffffff, 0.92)).setVisible(false),
      halo: low() || cand() ? null : img(TEX.halo, true).setTint(col).setVisible(false),
      thread: cand() && rec.heat > 0.03 ? img(TEX.body, false).setOrigin(1, 0.5).setTint(THREAD).setVisible(false) : null,
      frac: rec.heat,
    };
    if (v.halo) stats.streakHalos = (stats.streakHalos || 0) + 1;
    recs.push(v);
    if (recs.length > stats.peakRounds) stats.peakRounds = recs.length;
    flashes.push({ t: 0, life: rec.accent ? 70 : 54, ang, heat, accent: rec.accent, n: rec.n, img: img(TEX.mz[rec.n % 3], false), glow: low() ? null : img(TEX.halo, true) });
    lastShotClock = clockNow; lastDir = ang; shotN = rec.n;
  }
  function onRoundEnd(rec) {
    const v = recs.find((q) => q.r === rec);
    if (!v || v.dead) return;
    v.dead = true;
    const b = rec.b;
    let c = contactOf.get(b);
    if (c && c.gen !== rec.gen) { stats.staleContacts++; c = null; }
    contactOf.delete(b);
    // a contact B2 drew, else where the collider stopped (range, wall, field)
    v.endX = c ? c.x : b.x; v.endY = c ? c.y : b.y;
    v.deathX = b.x; v.deathY = b.y; v.hitR = c ? (c.r ?? 0) : 0;
    const along = (v.endX - v.ox) * Math.cos(v.ang) + (v.endY - v.oy) * Math.sin(v.ang);
    v.tLen = Math.max(0, Math.min(v.len, along));
    v.hit = !!c;
    // how it ended, for the skin: a body contact, a wall, its range (Bullet.preUpdate kills it the
    // frame `traveled` reaches `range`), or anything else (a field, a clear, a restart)
    const kind = c ? 'hit' : wallEnd.get(b) === rec.gen ? 'wall' : (b._gen === rec.gen && b.range > 0 && b.traveled >= b.range) ? 'expire' : 'cancel';
    wallEnd.delete(b);
    stats.ends[kind] = (stats.ends[kind] || 0) + 1;
    skin?.roundEnd?.(v, kind);
  }
  function checkStreak(v, hx, hy, L, live) {
    inv.checks++;
    const cx = Math.cos(v.ang), cy = Math.sin(v.ang);
    const off = Math.abs(-(hx - v.ox) * cy + (hy - v.oy) * cx);            // distance from the line
    const headAlong = (hx - v.ox) * cx + (hy - v.oy) * cy, tailAlong = headAlong - L;
    let endErr = 0, why = null;
    if (live) endErr = Math.hypot(hx - v.r.b.x, hy - v.r.b.y);
    else endErr = Math.max(0, Math.hypot(hx - v.deathX, hy - v.deathY) - (v.hit ? v.hitR : 0));
    if (off > 1.5) why = 'off-line';
    else if (tailAlong < -2) why = 'behind-barrel';
    else if (endErr > 2) why = live ? 'head-not-at-collider' : 'end-not-at-death';
    if (off > inv.maxOff) inv.maxOff = off;
    if (endErr > inv.maxEndErr) inv.maxEndErr = endErr;
    if (why) {
      inv.bad++;
      if (inv.samples.length < 12) inv.samples.push({ why, n: v.r.n, live, hit: !!v.hit, off: +off.toFixed(1), endErr: +endErr.toFixed(1), head: [Math.round(hx), Math.round(hy)], death: v.dead ? [Math.round(v.deathX), Math.round(v.deathY)] : null, origin: [Math.round(v.ox), Math.round(v.oy)] });
    }
  }
  function drawStreak(v, hx, hy, L, live, alpha) {
    if (L > 1.5) checkStreak(v, hx, hy, L, live);
    if (skin) { skin.roundDraw(v, hx, hy, L, live); return; }
    if (L <= 1.5) { v.trail?.setVisible(false); v.body.setVisible(false); v.core.setVisible(false); v.head.setVisible(false); v.halo?.setVisible(false); v.thread?.setVisible(false); return; }
    const depth = hy + 3;
    const wide = (v.r.accent ? 1.25 : 1) * (0.9 + 0.35 * v.heat);
    v.trail?.setVisible(true).setPosition(hx, hy).setRotation(v.ang).setScale(L / 72, wide).setDepth(depth).setAlpha(alpha * (0.7 + 0.3 * v.heat));
    v.body.setVisible(true).setPosition(hx, hy).setRotation(v.ang).setScale(L / 72, v.r.accent ? 1.25 : 1).setDepth(depth + 0.05).setAlpha(alpha);
    v.core.setVisible(true).setPosition(hx, hy).setRotation(v.ang).setScale((L * 0.7) / 72, 1).setDepth(depth + 0.1).setAlpha(alpha);
    v.thread?.setVisible(true).setPosition(hx, hy).setRotation(v.ang).setScale((L * 0.96 * v.frac) / 72, 1.0).setDepth(depth + 0.15).setAlpha(alpha);
    if (live) {
      v.head.setVisible(true).setPosition(hx, hy).setRotation(v.ang).setScale(v.r.accent ? 1.2 : 1).setDepth(depth + 0.2);
      v.halo?.setVisible(true).setPosition(hx, hy).setScale((0.62 + 0.4 * v.heat) * (v.r.accent ? 1.25 : 1)).setAlpha(0.5 + 0.3 * v.heat).setDepth(depth + 0.05);
    } else { v.head.setVisible(false); v.halo?.setVisible(false); }
  }
  function updateRounds(dt) {
    for (let i = recs.length - 1; i >= 0; i--) {
      const v = recs[i], b = v.r.b;
      if (!v.dead) {
        if (b.visible) b.setVisible(false);
        const along = (b.x - v.ox) * Math.cos(v.ang) + (b.y - v.oy) * Math.sin(v.ang);
        drawStreak(v, b.x, b.y, Math.min(v.len, along), true, 1);
        continue;
      }
      // the light already in flight runs into the end point
      v.back += v.speed * dt / 1000;
      const L = v.tLen - v.back;
      if (L <= 1.5) { if (skin) skin.roundFree(v); else { free(v.trail); free(v.body); free(v.core); free(v.head); free(v.halo); free(v.thread); } recs.splice(i, 1); continue; }
      drawStreak(v, v.endX, v.endY, L, false, v.hit ? 1 : Math.max(0, L / Math.max(1, v.tLen)));
    }
  }

  // ── contacts ────────────────────────────────────────────────────────────
  const lastFull = new WeakMap();    // enemy -> clock of its last full white flash
  let cur = null;                    // the enemy the current hit call is resolving
  function spark(x, y, ang, heat, big, depth, kind) {
    stats.contacts++;
    if (skin) { skin.hitNew(x, y, ang, big, depth, kind); return; }
    if (big && !low() && !cand()) stats.impactPools = (stats.impactPools || 0) + 1;
    const col = tone(heat);
    sparks.push({ t: 0, life: big ? 110 : 74, x, y, big, depth,
      img: img(TEX.spark, false).setOrigin(0.1, 0.5).setRotation(ang).setTint(lerpInt(col, 0xffffff, 0.6)),
      glow: low() ? null : img(TEX.halo, true).setTint(col),
      spill: low() || !big || cand() ? null : img(TEX.spill, true).setTint(col) });
  }
  function onContact(e, b, flinch) {
    cur = e; C.dmg = true;
    const ang = Math.atan2(b.body.velocity.y, b.body.velocity.x);
    const R = (e.cfg?.radius ?? 22) * 0.82;
    const cx = Math.cos(ang), cy = Math.sin(ang);
    const ent = circleEntry(b.x - cx * 40, b.y - cy * 40, ang, e.x, e.y, R);
    // On the round's own path: a grazing hit (the line misses the inner circle) would return
    // the rim point beside the path; project it back onto the line the streak travels.
    const along = (ent.x - b.x) * cx + (ent.y - b.y) * cy;
    const c = { x: b.x + cx * along, y: b.y + cy * along, gen: b._gen,
      // how far a body contact can sit from where the collider is when the hit resolves:
      // the entry radius + the body + the bolt's hitbox + one frame of travel
      r: R + (e.cfg?.radius ?? 22) + (b.body?.radius ?? 30) + 20 };
    contactOf.set(b, c);
    skin?.setContactRound(recs.find((q) => q.r.b === b && q.r.gen === b._gen) || null);
    spark(c.x, c.y, ang, Math.min(1, api.charge01() + (flinch ? 0.15 : 0)), flinch, Math.max(e.depth ?? e.y, c.y) + 4);
  }
  function updateSparks(dt) {
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i]; s.t += dt;
      const u = s.t / s.life;
      if (u >= 1) { free(s.img); free(s.glow); free(s.spill); sparks.splice(i, 1); continue; }
      const k = s.big ? 1.25 : 0.9;
      s.img.setPosition(s.x, s.y).setScale(k * (0.7 + 0.7 * u), k * (1 - 0.35 * u)).setAlpha(1 - u * u).setDepth(s.depth);
      s.glow?.setPosition(s.x, s.y).setScale(k * (0.7 + 0.5 * u)).setAlpha(0.75 * (1 - u)).setDepth(s.depth - 0.1);
      s.spill?.setPosition(s.x, s.y + 8).setScale(0.75).setAlpha(0.3 * (1 - u)).setDepth(5);
    }
  }

  // ── the shipped per-shot effects B2 replaces, intercepted in context ────
  const C = { hit: false, wall: false, dmg: false };   // dmg: inside the hit's own damage() call
  const restores = [];
  const wrap = (obj, name, make) => {
    if (!obj || typeof obj[name] !== 'function') return;
    const had = Object.prototype.hasOwnProperty.call(obj, name);
    const prev = obj[name];
    const mine = make(prev);
    obj[name] = mine;
    restores.push(() => { if (obj[name] === mine) { if (had) obj[name] = prev; else delete obj[name]; } });
  };
  const mineGroup = (g) => g === scene.playerBullets;
  wrap(scene, 'handleBulletEnemyHits', (prev) => function (g, ...r) {
    if (!mineGroup(g)) return prev.call(this, g, ...r);
    C.hit = true; try { return prev.call(this, g, ...r); } finally { C.hit = false; cur = null; }
  });
  wrap(scene, 'handleBulletWallHits', (prev) => function (g, ...r) {
    if (!mineGroup(g)) return prev.call(this, g, ...r);
    const live = g.getChildren().filter((b) => b.active);
    C.wall = true; try { return prev.call(this, g, ...r); } finally { C.wall = false; for (const b of live) if (!b.active) wallEnd.set(b, b._gen); }
  });
  wrap(scene, '_impactMicroFlash', (prev) => function (...a) { return C.wall ? undefined : prev.apply(this, a); });
  wrap(fx, 'impactRing', (prev) => function (x, y, color, ...r) {
    if (C.hit && cur && (color === 0xee3030 || (C.dmg && color === 0xffd8a0))) { stats.dropped.ring++; return undefined; }
    if (C.wall && color === 0xb0b0b0) { stats.dropped.ring++; return undefined; }
    return prev.call(this, x, y, color, ...r);
  });
  wrap(fx, 'burstDir', (prev) => function (x, y, color, count, ang, spread) {
    if (C.hit && cur && color === 'red' && count === 7) { stats.dropped.burst++; return undefined; }
    if (C.wall && color === 'yellow' && count === 6) {
      stats.dropped.burst++;
      skin?.setContactRound(null, tipStep(api.charge01()));
      spark(x, y, ang, api.charge01() * 0.6, false, y + 60, 'wall');     // thrown back off the surface
      return undefined;
    }
    return prev.call(this, x, y, color, count, ang, spread);
  });
  wrap(fx, 'burst', (prev) => function (x, y, color, count) {
    if (C.dmg && cur && color === 'red' && (count === 4 || count === 8) && x === cur.x && y === cur.y) { stats.dropped.burst++; return undefined; }
    return prev.call(this, x, y, color, count);
  });
  // THE HIT HIERARCHY: one full flash, then a warm tint while the stream stays on it.
  wrap(fx, 'hitFlash', (prev) => function (spr) {
    if (!(C.dmg && cur && spr === cur)) return prev.call(this, spr);
    const t = lastFull.get(spr);
    if (t == null || clockNow - t >= 320) { lastFull.set(spr, clockNow); stats.flashesFull++; return prev.call(this, spr); }
    stats.flashesSoft++;
    if (clockNow - t < 90) return undefined;            // the full flash is still up
    const token = (spr._b2Tint = (spr._b2Tint || 0) + 1);
    spr.setTint(0xffc4b0);
    scene.time.delayedCall(55, () => { if (spr.active && spr._b2Tint === token) spr.clearTint(); });
    return undefined;
  });
  // DAMAGE NUMBERS ROLL UP per target: one figure per ~260ms and one at the kill.
  const acc = new Map();             // enemy -> { sum, t0, x, y }
  let passNumber = false;
  const flush = (e, a, killed) => {
    acc.delete(e);
    if (a.sum < 0.5) return;
    stats.numbersOut++;
    passNumber = true;
    const numCol = skin ? skin.numberColor(killed, tipStep(api.charge01())) : hex(lerpInt(tone(api.charge01()), 0xffffff, killed ? 0.15 : 0.55));
    try { fx.damageNumber(a.x, a.y, Math.round(a.sum), numCol, 'minor'); } finally { passNumber = false; }
  };
  wrap(fx, 'damageNumber', (prev) => function (x, y, amount, color, tier) {
    if (passNumber || !(C.dmg && cur) || typeof amount !== 'number' || tier === 'major') return prev.call(this, x, y, amount, color, tier);
    stats.numbersIn++;
    let a = acc.get(cur);
    if (!a) { a = { sum: 0, t0: clockNow, x, y }; acc.set(cur, a); }
    a.sum += amount; a.x = x; a.y = y;
    return undefined;
  });
  // The rifle's own tick replaces the generic hit beep for its rounds.
  wrap(SFX, 'hit', (prev) => function (...a) {
    if (C.dmg && cur) { stats.dropped.beep++; voice?.hitTick(api.charge01()); return undefined; }
    return prev.apply(this, a);
  });
  const onDied = (e) => {
    const a = acc.get(e);
    if (a) flush(e, a, true);
    if (scene._dmgSrc === 'primary') voice?.killTick();
  };
  scene.events.on('enemy-died', onDied);

  // TEMPER: created after the wrappers above, so its own (the Super's shipped effects) sit
  // outside them and are restored first.
  // REACTOR OVERLOAD (`&b2r=1`, systems/b2Reactor.js) is a second skin on the same hooks; it wins if both are set.
  if (api.reactor) { skin = createReactorSkin(scene, api, K, { muzzleNow, wrap }, { r2: api.reactor === 2 }); stats.reactor = skin.stats; }
  else if (api.temper) { skin = createTemperSkin(scene, api, K, { muzzleNow, wrap }); stats.temper = skin.stats; }
  if (skin) stats.skin = skin.stats;

  // ── HUD: the pips are for a three-round pistol ──────────────────────────
  const hudRestore = [];
  function hideAmmo(hud) {
    if (!hud?.ammoPips || hud._b2Ammo) return;
    hud._b2Ammo = true;
    const orig = hud.refreshAmmo;
    hud.refreshAmmo = function () { for (const pip of this.ammoPips) pip.setVisible(false); };
    hud.refreshAmmo();
    hudRestore.push(() => { delete hud._b2Ammo; if (Object.prototype.hasOwnProperty.call(hud, 'refreshAmmo')) delete hud.refreshAmmo; try { for (const pip of hud.ammoPips || []) pip.setVisible(true); orig.call(hud); } catch (_) { /* */ } });
  }
  const hudScene = scene.game.scene.getScene('HUD');
  const onHudCreate = () => hideAmmo(scene.game.scene.getScene('HUD'));
  if (hudScene?.ammoPips && hudScene.sys.isActive()) hideAmmo(hudScene);
  hudScene?.events?.on('create', onHudCreate);

  // ── persistent pieces: the ember (the meter on the gun), floor light, magazine
  const ember = scene.add.image(0, 0, TEX.halo).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
  const rim = scene.add.image(0, 0, TEX.ring).setBlendMode(Phaser.BlendModes.ADD).setTint(CYAN).setVisible(false);
  const spill = scene.add.image(0, 0, TEX.spill).setBlendMode(Phaser.BlendModes.ADD).setDepth(5).setVisible(false);
  const magBar = scene.add.graphics().setVisible(false);
  let magKey = '', magShown = 0, reload = null;

  function updateMuzzle(dt, p) {
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i]; f.t += dt;
      const u = f.t / f.life;
      const m = p?.alive ? muzzleNow(p, f.ang) : null;
      if (u >= 1 || !m) { free(f.img); free(f.glow); flashes.splice(i, 1); continue; }
      const col = tone(f.heat);
      const s = (1.0 + (cand() ? 0 : 0.45 * f.heat)) * (f.accent ? 1.3 : 1) * FLICK[f.n % 5];
      f.img.setOrigin(0, 0.5).setPosition(m.x, m.y).setRotation(m.rot).setScale(s * (0.75 + 0.55 * u), s * (1 - 0.45 * u)).setAlpha(1 - u * u).setTint(lerpInt(col, 0xffffff, 0.7)).setDepth((m.depth ?? p.depth) + 0.3);
      f.glow?.setPosition(m.x, m.y).setScale(s * (0.9 + 0.5 * u)).setAlpha(0.85 * (1 - u)).setTint(col).setDepth((m.depth ?? p.depth) + 0.2);
    }
  }
  // the candidate's quarter steps: a ring pops at the barrel as each quarter of the meter fills
  let lastStep = 0;
  const steps = [];
  function updateSteps(dt, p) {
    const c = api.charge01();
    const k = c >= 1 ? 4 : Math.floor(c * 4 + 1e-9);
    if (k > lastStep && k < 4 && p?.alive) { steps.push({ t: 0, k, img: img(TEX.ring, true).setTint(STEP) }); stats.steps = (stats.steps || 0) + 1; }
    lastStep = k;
    for (let i = steps.length - 1; i >= 0; i--) {
      const s2 = steps[i]; s2.t += dt;
      const u = s2.t / 220;
      const m = p?.alive ? muzzleNow(p, api.state.aimAng ?? p.facing) : null;
      if (u >= 1 || !m) { free(s2.img); steps.splice(i, 1); continue; }
      s2.img.setPosition(m.x, m.y).setDepth((m.depth ?? p.depth) + 0.4).setScale((0.35 + 0.18 * s2.k) * (0.6 + 0.8 * u)).setAlpha(1 - u);
    }
  }
  function updateMeter(dt, p) {
    if (cand()) {
      ember.setVisible(false); rim.setVisible(false);
      updateSteps(dt, p);
      if (low() || !p?.alive) { spill.setVisible(false); return; }
      const since2 = clockNow - lastShotClock, fire2 = Math.max(0, 1 - since2 / 150);
      if (fire2 <= 0.01) { spill.setVisible(false); return; }
      spill.setVisible(true).setTint(lerpInt(COLD, 0xffffff, 0.25)).setAlpha(fire2 * 0.28)
        .setPosition(p.x + Math.cos(lastDir) * 46, p.y + Math.sin(lastDir) * 46 + 14).setScale(1.4 * FLICK[shotN % 5], 1.0 * FLICK[shotN % 5]);
      return;
    }
    const c = api.charge01();
    const m = p?.alive ? muzzleNow(p, p.aiming || api.state.trig ? (api.state.aimAng ?? p.facing) : p.facing) : null;
    const since = clockNow - lastShotClock;
    const primed = c >= 1;
    if (!m || (c < 0.04 && since > 200)) { ember.setVisible(false); rim.setVisible(false); }
    else {
      const pulse = primed ? 0.5 + 0.5 * Math.sin(clockNow * 0.011) : 0;
      ember.setVisible(true).setPosition(m.x, m.y).setTint(b2HeatColor(c)).setDepth((m.depth ?? p.depth) + 0.1)
        .setScale(0.34 + 0.4 * c + 0.12 * pulse).setAlpha((m.alpha ?? 1) * (0.16 + 0.5 * c + 0.2 * pulse));
      const sincePrimed = clockNow - primedAt;
      if (primed) {
        const pop = sincePrimed < 260 ? 1 + 1.6 * (1 - sincePrimed / 260) : 1;
        rim.setVisible(true).setPosition(m.x, m.y).setDepth((m.depth ?? p.depth) + 0.15).setScale((0.52 + 0.1 * pulse) * pop).setAlpha((0.5 + 0.4 * pulse) * (m.alpha ?? 1));
      } else rim.setVisible(false);
    }
    // the light on the floor: the stream's, and a faint breath when primed
    if (low() || !p?.alive) { spill.setVisible(false); return; }
    const fire = Math.max(0, 1 - since / 150);
    const idle = primed ? 0.07 + 0.05 * Math.sin(clockNow * 0.011) : 0;
    const al = Math.max(fire * (0.3 + 0.14 * c), idle);
    if (al <= 0.01) { spill.setVisible(false); return; }
    const dir = fire > 0 ? lastDir : p.facing;
    const reach = fire > 0 ? 46 : 26;
    spill.setVisible(true).setTint(lerpInt(b2HeatColor(c), 0xffffff, 0.25)).setAlpha(al)
      .setPosition(p.x + Math.cos(dir) * reach, p.y + Math.sin(dir) * reach + 14)
      .setScale((fire > 0 ? 1.5 + 0.9 * c : 1.1) * FLICK[shotN % 5], (fire > 0 ? 1.1 + 0.6 * c : 0.8) * FLICK[shotN % 5]);
  }
  function updateMag(dt, p) {
    const s = api.state;
    const rl = s.reloadLeft > 0;
    const full = s.mag >= K.mag && !rl;
    if (!p?.alive || (p.secondary && p.secondaryAmmo > 0)) { magBar.setVisible(false); magShown = 0; return; }
    magShown = full ? Math.max(0, magShown - dt) : 700;
    if (magShown <= 0) { magBar.setVisible(false); return; }
    const frac = rl ? 1 - s.reloadLeft / Math.max(1, s.reloadDur) : s.mag / K.mag;
    const lowMag = !rl && s.mag <= Math.ceil(K.mag * 0.2);
    const blink = lowMag && Math.floor(clockNow / 110) % 2 === 0;
    const key = `${rl ? 'r' : 'm'}${Math.round(frac * 40)}${blink ? 'b' : ''}${s.hot > 0 ? 'h' : ''}`;
    magBar.setVisible(true).setPosition(Math.round(p.x), Math.round(p.y + PLAYER.radius + 22)).setDepth(p.depth + 6).setAlpha(Math.min(1, magShown / 250));
    if (key === magKey) return;
    magKey = key;
    const W = 58, H = 6;
    magBar.clear();
    magBar.fillStyle(0x05070c, 0.78); magBar.fillRect(-W / 2 - 2, -H / 2 - 2, W + 4, H + 4);
    magBar.fillStyle(rl ? 0xffb030 : blink ? 0xff3a2c : s.hot > 0 ? 0xffd27a : 0xe8f6ff, 1);
    magBar.fillRect(-W / 2, -H / 2, Math.round(W * frac), H);
    // four cuts: ten rounds each
    magBar.fillStyle(0x05070c, 0.9);
    for (let i = 1; i < 4; i++) magBar.fillRect(-W / 2 + Math.round((W * i) / 4), -H / 2, 1, H);
  }

  // ── `&b2dbg=1`: the diagnostic overlay ───────────────────────────────────
  //  yellow +  the barrel face the eye sees (the P1 weapon's muzzle)
  //  green  +  where gameplay spawns the round (PLAYER.radius + 12 along the aim)
  //  cyan      each live round: its recorded origin -> its collider, and the collider
  //  orange    each finishing streak: the segment drawn this frame; red x = where its
  //            collider actually stopped
  //  The panel shows the invariant counters (see `inv`).
  const dbg = isB2Debug();
  const dg = dbg ? scene.add.graphics().setDepth(9000) : null;
  const dpanel = dbg && typeof document !== 'undefined' ? document.createElement('div') : null;
  if (dpanel) {
    dpanel.id = 'b2-dbg';
    dpanel.style.cssText = 'position:fixed;right:6px;bottom:6px;z-index:31;font:11px monospace;color:#cfe;background:rgba(0,0,0,.7);padding:4px 6px;pointer-events:none;white-space:pre';
    document.body.appendChild(dpanel);
    if (typeof window !== 'undefined') window.__b2dbg = inv;
  }
  const cross = (x, y, col, r = 5) => { dg.lineStyle(1.5, col, 1); dg.lineBetween(x - r, y, x + r, y); dg.lineBetween(x, y - r, x, y + r); };
  function drawDebug(p) {
    dg.clear();
    if (p?.alive) {
      const a = api.state.aimAng ?? p.aim ?? p.facing;
      const m = muzzleNow(p, a);
      cross(m.x, m.y, 0xffe040);
      cross(p.x + Math.cos(a) * (PLAYER.radius + 12), p.y + Math.sin(a) * (PLAYER.radius + 12), 0x40ff60);
    }
    for (const v of recs) {
      const cx = Math.cos(v.ang), cy = Math.sin(v.ang);
      if (!v.dead) {
        dg.lineStyle(1, 0x40e0ff, 0.8); dg.lineBetween(v.ox, v.oy, v.r.b.x, v.r.b.y);
        dg.fillStyle(0x40e0ff, 1); dg.fillCircle(v.r.b.x, v.r.b.y, 2.5);
      } else {
        const L = Math.max(0, v.tLen - v.back);
        dg.lineStyle(2, 0xff9020, 1); dg.lineBetween(v.endX - cx * L, v.endY - cy * L, v.endX, v.endY);
        dg.lineStyle(1.5, 0xff2020, 1); dg.lineBetween(v.deathX - 4, v.deathY - 4, v.deathX + 4, v.deathY + 4); dg.lineBetween(v.deathX - 4, v.deathY + 4, v.deathX + 4, v.deathY - 4);
      }
    }
    if (dpanel) dpanel.textContent = `B2 TRACERS  streaks ${recs.length}\nchecks ${inv.checks}  BAD ${inv.bad}\nmax off-line ${inv.maxOff.toFixed(1)}px  max end err ${inv.maxEndErr.toFixed(1)}px${inv.samples.length ? `\nlast: ${inv.samples[inv.samples.length - 1].why}` : ''}`;
  }

  function update(dt, clock) {
    const t0 = performance.now();
    clockNow = clock;
    const p = scene.player;
    if (skin) {
      updateRounds(dt);
      skin.update(dt, clock, p);
    } else {
      updateSparks(dt);
      updateRounds(dt);
      updateMuzzle(dt, p);
      updateMeter(dt, p);
    }
    updateMag(dt, p);
    if (dg) drawDebug(p);
    for (const [e, a] of acc) if (clockNow - a.t0 >= 260 || !e.active || !e.alive) flush(e, a, false);
    const ms = performance.now() - t0;
    stats.updN++; stats.updMs += ms; if (ms > stats.updMax) stats.updMax = ms;
  }

  return {
    stats, update, onRound, onRoundEnd, onContact,
    afterContact() { C.dmg = false; },
    onReload(kind) { reload = kind; magKey = ''; },
    onReloaded() { reload = null; magKey = ''; magShown = 700; },
    onRelease() { /* the stream's light decays on its own */ },
    onSuper() { superAt = clockNow; skin?.onSuper(); },
    onPrimed() { if (clockNow - primedAt > 400) voice?.primed(); primedAt = clockNow; },
    onOvercharge() { hotFlashAt = clockNow; magKey = ''; },
    heatColor: b2HeatColor,
    destroy() {
      scene.events.off('enemy-died', onDied);
      hudScene?.events?.off('create', onHudCreate);
      try { skin?.destroy(); } catch (_) { /* */ }
      restores.splice(0).reverse().forEach((f) => { try { f(); } catch (_) { /* */ } });
      hudRestore.splice(0).forEach((f) => { try { f(); } catch (_) { /* */ } });
      for (const o of [ember, rim, spill, magBar, dg, ...pool]) { try { o?.destroy(); } catch (_) { /* */ } }
      dpanel?.remove();
      for (const v of recs) for (const o of [v.trail, v.body, v.core, v.head, v.halo, v.thread, v.bolt, v.glow]) { try { o?.destroy(); } catch (_) { /* */ } }
      for (const f of flashes) { try { f.img.destroy(); f.glow?.destroy(); } catch (_) { /* */ } }
      for (const s of sparks) { try { s.img.destroy(); s.glow?.destroy(); s.spill?.destroy(); } catch (_) { /* */ } }
      for (const s2 of steps) { try { s2.img.destroy(); } catch (_) { /* */ } }
      steps.length = 0;
      pool.length = 0; recs.length = 0; flashes.length = 0; sparks.length = 0; acc.clear();
    },
  };
}
