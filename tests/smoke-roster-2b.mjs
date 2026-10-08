// ROSTER PHASE 2B — RIFLEMAN (internal `grunt`) and MARKSMAN (internal `sniper`)
// ON THEIR PRODUCTION ART.
//
// Objective checks only; whether they read is the handset's question. Pinned:
//   - under `?roster=v1` each role, Regular and Elite, wears its own sheet and
//     weapon on the stock 33-frame / 18-key contract; legacy is untouched;
//   - every gameplay value is identical to legacy AND to the 88e9b89 fixture,
//     incl. the Elite's historical physics footprint at render scale 1, the
//     sniper's windup / lock / range / retreat, and the spawn distance;
//   - a seeded, hand-stepped SNIPER NEST (snipers + grunts) is the SAME FIGHT
//     under both flags — positions, hp, AI, every shot, every random draw —
//     and every sniper laser telegraph draws the SAME commands, tick for tick;
//   - the drawn muzzle of BOTH weapons is on the bolt axis at the bolt's first
//     drawn leading edge, at 8 bearings x 2 tiers (incl. the flipped west);
//   - the rifle's warning keeps its legacy ticks; the Gunner's muzzle / rotor
//     never fires for either role; movement v2.2 reaches the Rifleman only.
//
// usage: node tests/smoke-roster-2b.mjs

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const BASE = 'http://localhost:5173/';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ROOT = new URL('..', import.meta.url).pathname;
const hist = JSON.parse(readFileSync(new URL('./fixtures/roster-legacy-88e9b89.json', import.meta.url).pathname, 'utf8'));
const checks = [];
const check = (ok, label, detail) => { checks.push({ ok: !!ok, label, detail }); };
const fail = (m) => { console.error(`FAIL: ${m}`); process.exit(1); };
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-setuid-sandbox'] });

async function stepped(query) {
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  page.on('pageerror', (e) => fail(`page error (${query}): ${e.message}`));
  await page.goto(BASE + query);
  await page.waitForFunction(() => window.game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 45000 });
  await page.evaluate(async () => {
    const g = window.game;
    g.loop.sleep();
    let s = 12345;
    window.__draws = 0;
    Math.random = () => { window.__draws++; s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    window.__t = 100000;
    Date.now = () => window.__t;
    window.__adv = (n = 1) => { for (let i = 0; i < n; i++) { window.__t += 1000 / 60; g.step(window.__t, 1000 / 60); } };
    g.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 4242 });
    window.__adv(2);
    const url = performance.getEntriesByType('resource').map((r) => r.name).find((n) => /systems\/debug\.js/.test(n));
    (await import(url)).setGodMode(true);
    window.__gs = g.scene.getScene('Game');
    for (let i = 0; i < 300 && !window.__gs.roomSpec; i++) window.__adv(1);
    window.__adv(20);
  });
  return page;
}

const UNIT = () => {
  window.__unit = (type, spec = {}) => {
    const gs = window.__gs;
    const e = gs.spawnEnemyAt(type, 900, 900, spec);
    e.body.updateFromGameObject?.();
    const c = e.cfg;
    const r = {
      play: {
        hp: e.hp, hpMax: e.hpMax, radius: c.radius, speed: c.speed,
        bodyW: e.body.width, bodyHalf: e.body.halfWidth,
        bodyDx: +(e.body.center.x - e.x).toFixed(3), bodyDy: +(e.body.center.y - e.y).toFixed(3),
        gunDist: e.weaponSprite ? c.radius - 4 : null, muzzleDist: c.radius + 4,
        shieldHalf: e._shieldHalfArc ?? null, shieldTurn: e._shieldTurnRate ?? null,
        elite: !!e._elite, rusher: e._isRusher ?? null,
      },
      cfg: { fireCd: c.fireCooldownMs, bSpeed: c.bulletSpeed, bDmg: c.bulletDamage, bRange: c.bulletRange,
        desired: c.desiredRange, retreat: c.retreatRange ?? null, windup: c.windupMs ?? null, lock: c.lockMs ?? null },
      look: {
        tex: e.texture.key, prefix: e._animPrefix, scale: +e.scaleX.toFixed(4), baseScale: e._baseScale,
        tint: e.tintTopLeft, tinted: e.isTinted, weapon: e.weaponSprite?.texture?.key ?? null,
        gunnerMuzzle: !!e._muzzleFx, rosterFx: e._rosterFx ?? null,
        gunnerRotor: !!e._weaponFx && e._weaponFx !== e._rosterFxObj, loco: !!e._loco, v22: !!e._v22,
      },
    };
    gs._destroyEnemyFully(e);
    return r;
  };
};
const ROLES = [['grunt', 'Rifleman', 'ro-rif'], ['sniper', 'Marksman', 'ro-mrk']];

// ── units, legacy and v1 ─────────────────────────────────────────────────
const pL = await stepped('?nodlg=1&nofreeze=1');
await pL.evaluate(UNIT);
const L = await pL.evaluate(() => ({ grunt: window.__unit('grunt'), 'grunt+E': window.__unit('grunt', { elite: true }), sniper: window.__unit('sniper'), 'sniper+E': window.__unit('sniper', { elite: true }) }));
await pL.close();
const pV = await stepped('?nodlg=1&nofreeze=1&roster=v1&move=v22');
await pV.evaluate(UNIT);
const V = await pV.evaluate(() => ({ grunt: window.__unit('grunt'), 'grunt+E': window.__unit('grunt', { elite: true }), sniper: window.__unit('sniper'), 'sniper+E': window.__unit('sniper', { elite: true }),
  shooter: window.__unit('shooter'), bomber: window.__unit('bomber'), swarmling: window.__unit('swarmling'), shielded: window.__unit('shielded') }));

const strip = ({ rusher, ...p }) => p;
for (const [type, name, pre] of ROLES) {
  for (const [k, tier, sfx] of [[type, 'Regular', 'R'], [`${type}+E`, 'Elite', 'E']]) {
    const l = L[k], v = V[k], h = hist.units[k];
    check(v.look.tex === `${pre}-${sfx}` && v.look.prefix === `${pre}-${sfx}` && v.look.weapon === `${pre.replace('ro-', 'ro-w-')}-${sfx}`,
      `${name} ${tier}: wears ${pre}-${sfx} (texture + animation prefix) and weapon ${pre.replace('ro-', 'ro-w-')}-${sfx}`, JSON.stringify(v.look));
    check(JSON.stringify(strip(h.play)) === JSON.stringify(strip(v.play)) && JSON.stringify(l.play) === JSON.stringify(v.play),
      `${name} ${tier}: gameplay identical to legacy and to 88e9b89 — hp ${v.play.hp}, speed ${+v.play.speed.toFixed(2)}, radius ${v.play.radius}, body ${v.play.bodyW}px centred, gun ${v.play.gunDist} / spawn ${v.play.muzzleDist}`,
      `${JSON.stringify(l.play)} vs ${JSON.stringify(v.play)}`);
    check(JSON.stringify(l.cfg) === JSON.stringify(v.cfg),
      `${name} ${tier}: cadence ${v.cfg.fireCd}ms, bolt ${v.cfg.bSpeed}px/s ${v.cfg.bDmg}dmg ${v.cfg.bRange}px, desired ${v.cfg.desired}${v.cfg.windup ? `, retreat ${v.cfg.retreat}, windup ${v.cfg.windup} / lock ${v.cfg.lock}ms` : ''} — unchanged`,
      `${JSON.stringify(l.cfg)} vs ${JSON.stringify(v.cfg)}`);
    check(v.look.tint === 0xffffff && !v.look.tinted, `${name} ${tier}: no tint at all (baked palette; no gold, no identity tint)`, JSON.stringify(v.look));
    check(!v.look.gunnerMuzzle && !v.look.gunnerRotor && v.look.rosterFx === (type === 'grunt' ? 'rifle' : 'marksman'),
      `${name} ${tier}: its own firing language (${v.look.rosterFx}); the Gunner's muzzle and rotor are NOT attached`, JSON.stringify(v.look));
    check(l.look.tex !== v.look.tex && hist.units[k].look.tex === l.look.tex, `${name} ${tier}: legacy (no flag) still wears '${l.look.tex}'`, JSON.stringify(l.look));
  }
  const e = V[`${type}+E`];
  check(e.play.bodyW === 84 && e.look.scale === 1 && e.look.baseScale === 1,
    `${name} Elite: HISTORICAL physics footprint (84px) retained while rendering at scale 1.0`, JSON.stringify({ ...e.play, scale: e.look.scale }));
}
check(V.grunt.look.loco && V.grunt.look.v22 && V['grunt+E'].look.v22, 'Rifleman (Regular + Elite) runs the approved movement v2.2 under ?move=v22', JSON.stringify(V.grunt.look));
check(!V.sniper.look.loco && !V.sniper.look.v22 && !V['sniper+E'].look.v22, 'Marksman does NOT get movement v2.2 — it keeps its own sniper logic', JSON.stringify(V.sniper.look));
check(V.shooter.look.tex === 'ro-gun-R' && V.shooter.look.gunnerRotor && V.shooter.look.gunnerMuzzle && !V.shooter.look.rosterFx,
  'the Gunner is untouched: ro-gun-R, its own v5 rotor and muzzle, no 2B FX', JSON.stringify(V.shooter.look));
// The Bulwark and the Demolisher have their own production art since their
// integrations (smoke-bulwark / smoke-demolisher own them); what this file
// still pins is that neither 2B firing cycle attaches to either, and that the
// swarmling stays legacy.
check(V.bomber.look.tex === 'ro-dem-R' && V.swarmling.look.tex === 'grunt' && !V.bomber.look.rosterFx && !V.swarmling.look.rosterFx
  && V.shielded.look.tex === 'ro-blw-R' && V.shielded.look.rosterFx === 'sidearm',
  'swarmling stays on legacy art with no 2B FX; the Demolisher (bomber) wears its own art with no 2B FX though both are grunt subclasses; the Bulwark wears its own art and its own sidearm cycle, never a 2B one', JSON.stringify({ b: V.bomber.look, s: V.swarmling.look, sh: V.shielded.look }));

// ── sheet contract ─────────────────────────────────────────────────────────
const sheet = await pV.evaluate(() => {
  const gs = window.__gs, out = {};
  for (const key of ['ro-rif-R', 'ro-rif-E', 'ro-mrk-R', 'ro-mrk-E']) {
    const tex = gs.textures.get(key);
    const names = tex.getFrameNames().filter((n) => n !== '__BASE').map(Number).sort((a, b) => a - b);
    const src = tex.getSourceImage();
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    const x = c.getContext('2d'); x.drawImage(src, 0, 0);
    const fw = 96, fh = 104, hashes = [], empty = [], clipped = [], widths = [];
    for (let f = 0; f < 33; f++) {
      const d = x.getImageData(f * fw, 0, fw, fh).data;
      let h = 2166136261, n = 0, minX = fw, maxX = -1;
      for (let i = 0; i < d.length; i++) { h ^= d[i]; h = Math.imul(h, 16777619) >>> 0; }
      for (let i = 3; i < d.length; i += 4) if (d[i]) { n++; const X = ((i - 3) / 4) % fw; minX = Math.min(minX, X); maxX = Math.max(maxX, X); }
      hashes.push(h); if (!n) empty.push(f); widths.push((maxX - minX + 1) / 4);
      for (let px = 0; px < fw * fh; px++) {
        const X = px % fw, Y = Math.floor(px / fw);
        if (X > 3 && X < fw - 4 && Y > 3 && Y < fh - 4) continue;
        const i = px * 4;
        if (d[i + 3] && !(d[i] === 6 && d[i + 1] === 7 && d[i + 2] === 10)) { clipped.push(f); break; }
      }
    }
    const fr = tex.get(0), want = [];
    ['front', 'back', 'side'].forEach((dir, di) => {
      const off = di * 8;
      want.push([`${key}-idle-${dir}`, [off]], [`${key}-walk-${dir}`, [1, 2, 3, 4, 5, 6].map((k) => off + k)], [`${key}-fire-${dir}`, [off + 7]]);
      ['raise', 'thrust', 'recoil'].forEach((p, pi) => want.push([`${key}-${p}-${dir}`, [24 + di * 3 + pi]]));
    });
    const bad = want.filter(([k, frames]) => {
      const a = gs.anims.get(k);
      return !a || a.frames.length !== frames.length || a.frames.some((af, i) => af.textureKey !== key || +af.textureFrame !== frames[i]);
    }).map(([k]) => k);
    out[key] = { frames: names.length, contiguous: names.every((n, i) => n === i), fw: fr.width, fh: fr.height, empty, clipped,
      keys: want.length - bad.length, bad, walkDistinct: [0, 8, 16].every((o) => new Set(hashes.slice(o + 1, o + 7)).size >= 4),
      fireDistinct: [0, 8, 16].every((o) => hashes[o + 7] !== hashes[o]), frontWidthMax: Math.max(...widths.slice(0, 8)) };
  }
  return out;
});
for (const key of ['ro-rif-R', 'ro-rif-E', 'ro-mrk-R', 'ro-mrk-E']) {
  const s = sheet[key];
  check(s.frames === 33 && s.contiguous && s.fw === 96 && s.fh === 104 && !s.empty.length, `${key}: 33 frames, 0-32, each 96x104 (24x26 @4), none empty`, JSON.stringify(s));
  check(!s.clipped.length, `${key}: nothing but outline touches a frame border (no limb clipped)`, JSON.stringify(s.clipped));
  check(s.walkDistinct && s.fireDistinct, `${key}: each facing's 6 walk frames are a real cycle; the fire frame differs from idle`, JSON.stringify(s));
  check(s.keys === 18 && !s.bad.length, `${key}: all 18 animation keys exist and point at the right frames`, JSON.stringify(s.bad));
}
// the Marksman's leanness is measured, not asserted by eye: across every
// front-facing frame (idle, walk, fire) his widest silhouette is narrower than
// the Rifleman's, and the Elite adds no width at all
check(sheet['ro-mrk-R'].frontWidthMax < sheet['ro-rif-R'].frontWidthMax && sheet['ro-mrk-E'].frontWidthMax === sheet['ro-mrk-R'].frontWidthMax,
  `Marksman stays LEAN through the front cycle: widest ${sheet['ro-mrk-R'].frontWidthMax} logical px (Elite ${sheet['ro-mrk-E'].frontWidthMax}) against the Rifleman's ${sheet['ro-rif-R'].frontWidthMax}`,
  JSON.stringify({ m: sheet['ro-mrk-R'].frontWidthMax, mE: sheet['ro-mrk-E'].frontWidthMax, r: sheet['ro-rif-R'].frontWidthMax }));

// ── MUZZLE: both weapons on the bolt axis, at its first drawn leading edge ──
const muzzle = await pV.evaluate(() => {
  const gs = window.__gs;
  gs.arenaActive = false;
  for (const e of gs.enemies.getChildren().slice()) gs._destroyEnemyFully(e);
  const rows = [];
  for (const type of ['grunt', 'sniper']) for (const elite of [false, true]) for (let k = 0; k < 8; k++) {
    const aim = -Math.PI + k * Math.PI / 4;
    gs.enemyBullets.getChildren().forEach((b) => b.disableBody?.(true, true));
    const X = 700, Y = 700;
    const e = gs.spawnEnemyAt(type, X, Y, elite ? { elite: true } : {});
    e._performing = true; e._movePlanted = true; e._aim = aim;
    window.__adv(1);
    const ws = e.weaponSprite, c = Math.cos(aim), s = Math.sin(aim);
    const tip = new window.Phaser.Math.Vector2(), rear = new window.Phaser.Math.Vector2();
    ws.getWorldTransformMatrix().transformPoint((1 - ws.originX) * ws.width, 0, tip);
    ws.getWorldTransformMatrix().transformPoint(-ws.originX * ws.width, 0, rear);
    gs.fireShooter(e, aim);
    const b = gs.enemyBullets.getChildren().find((q) => q.active);
    const along = (q) => (q.x - X) * c + (q.y - Y) * s, perp = (q) => -(q.x - X) * s + (q.y - Y) * c;
    const spawn = along(b), spawnPerp = perp(b);
    window.__adv(1);
    rows.push({ type, elite, deg: Math.round(aim * 180 / Math.PI), tip: along(tip), tipPerp: perp(tip), rear: along(rear), spawn, spawnPerp,
      lead: along(b) + b.displayWidth / 2, gunLen: ws.width, flipY: ws.flipY });
    gs._destroyEnemyFully(e);
  }
  return rows;
});
for (const [type, name] of ROLES) {
  const m = muzzle.filter((r) => r.type === type);
  const off = m.filter((r) => Math.abs(r.tipPerp) > 0.5 || Math.abs(r.spawnPerp) > 0.5);
  check(m.length === 16 && !off.length && m.some((r) => r.flipY), `${name}: drawn muzzle AND gameplay spawn on the bolt axis at 8 bearings x 2 tiers (incl. the flipped west)`, JSON.stringify(off.slice(0, 2)));
  const lead = m.filter((r) => Math.abs(r.tip - r.lead) > 1.5);
  check(!lead.length, `${name}: the drawn muzzle sits at the bolt's leading edge on its first drawn frame (±1.5px) — ${m[0].tip.toFixed(1)}px from the body centre`, JSON.stringify(lead.slice(0, 2)));
  check(m.every((r) => r.rear < r.spawn && r.spawn < r.tip), `${name}: the gameplay spawn is INSIDE the drawn weapon`, '');
  check(m.every((r) => r.rear >= -12.5), `${name}: the weapon never reaches more than 12px behind the body centre (visor clear)`, JSON.stringify(m.map((r) => +r.rear.toFixed(1))));
}
const gunLen = (t, e) => muzzle.find((r) => r.type === t && r.elite === e).tip - muzzle.find((r) => r.type === t && r.elite === e).rear;
check(gunLen('grunt', false) < 84 && gunLen('sniper', false) > 84, `weapon length ORDER: carbine ${gunLen('grunt', false)}px < Gunner blaster 84px < precision rifle ${gunLen('sniper', false)}px`, '');

// ── firing presentation: rifle warning keeps its ticks; each role its own FX ──
const cyc = await pV.evaluate(() => {
  const gs = window.__gs;
  const run = (spec) => {
    const e = gs.spawnEnemyAt('grunt', 800, 800, spec);
    e.canSee = () => true; e._hasLOS = () => true; e._aim = 0; e._performing = false;
    const proto = Object.getPrototypeOf(Object.getPrototypeOf(Object.getPrototypeOf(e)));
    e.preUpdate = function (t, d) { proto.preUpdate.call(this, t, d); };
    e.fireCd = 600;
    let warnTick = -1, shotTick = -1, tinted = false, pip = false, minScale = 1;
    gs.events.once('shooter-fire', () => { shotTick = t; });
    let t = 0;
    for (; t < 60; t++) {
      const was = e._warnFlashed;
      e._maybeFireAt(1000 / 60, { x: 1100, y: 800 });
      if (!was && e._warnFlashed) warnTick = t;
      window.__adv(1);
      minScale = Math.min(minScale, e.scaleX);
      if (warnTick >= 0 && shotTick < 0) { tinted ||= e.weaponSprite.isTinted; pip ||= !!e._attachments.find((o) => o.type === 'Graphics' && o.visible); }
      if (shotTick >= 0 && t > shotTick + 10) break;
    }
    gs._destroyEnemyFully(e);
    return { warnTick, shotTick, tinted, pip, minScale: +minScale.toFixed(3) };
  };
  const count = (key) => gs.children.list.filter((o) => o.texture?.key === key && o.visible).length;
  const fx = {};
  for (const [k, type, spec] of [['rif', 'grunt', {}], ['rifE', 'grunt', { elite: true }], ['mrk', 'sniper', {}], ['mrkE', 'sniper', { elite: true }]]) {
    const e = gs.spawnEnemyAt(type, 800, 800, spec); e._performing = true; e._aim = 0;
    window.__adv(1);
    const b = { gun: count('fx-gun-muzzle'), rif: count('fx-rif-muzzle'), mrk: count('fx-mrk-muzzle') };
    gs.events.emit('shooter-fire', e, 0);
    const a = { gun: count('fx-gun-muzzle') - b.gun, rif: count('fx-rif-muzzle') - b.rif, mrk: count('fx-mrk-muzzle') - b.mrk };
    window.__adv(8);
    fx[k] = { ...a, after: count('fx-rif-muzzle') + count('fx-mrk-muzzle') };
    gs._destroyEnemyFully(e);
    gs.enemyBullets.getChildren().forEach((q) => q.disableBody?.(true, true));
  }
  return { R: run({}), E: run({ elite: true }), legacy: run({ legacyArt: true }), fx };
});
for (const k of ['R', 'E']) {
  const c = cyc[k];
  check(c.warnTick === cyc.legacy.warnTick && c.shotTick === cyc.legacy.shotTick && c.shotTick > c.warnTick,
    `Rifleman ${k}: the warning starts and the shot fires on the SAME ticks as legacy (${c.shotTick - c.warnTick} ticks of warning)`, JSON.stringify(cyc));
  check(!c.tinted && c.pip && c.minScale === 1, `Rifleman ${k}: the warning is the carbine's own ready pip (gun never tinted) and the body never squashes on screen`, JSON.stringify(c));
}
check(cyc.legacy.tinted, '(A/B) legacy Rifleman still tints the gun orange — the check above can fail', JSON.stringify(cyc.legacy));
check(cyc.fx.rif.rif === 1 && cyc.fx.rifE.rif === 1 && cyc.fx.mrk.mrk === 1 && cyc.fx.mrkE.mrk === 1
  && [cyc.fx.rif, cyc.fx.rifE, cyc.fx.mrk, cyc.fx.mrkE].every((f) => f.gun === 0) && cyc.fx.rif.mrk === 0 && cyc.fx.mrk.rif === 0,
  'one discharge per shot in each role\'s OWN language; the Gunner\'s muzzle never fires for either', JSON.stringify(cyc.fx));
check(Object.values(cyc.fx).every((f) => f.after === 0), 'every 2B discharge is gone within 133ms', JSON.stringify(cyc.fx));
await pV.close();

// ── THE SAME FIGHT: seeded SNIPER NEST, legacy vs v1, tick for tick ───────
async function nest(q) {
  const page = await stepped(`?nodlg=1&nofreeze=1&encdbg=sniperNest&room=corridor&sector=14&wave=1&move=v22${q}`);
  const r = await page.evaluate(() => {
    const gs = window.__gs;
    const ids = new Map(); let nid = 0;
    const id = (e) => { if (!ids.has(e)) ids.set(e, nid++); return ids.get(e); };
    const shots = [], snaps = [], lasers = [];
    let tick = 0, parked = null;
    const fire = gs.enemyBullets.fire.bind(gs.enemyBullets);
    gs.enemyBullets.fire = (x, y, ang, speed, dmg, range, opts) => { parked = { bx: +x.toFixed(3), by: +y.toFixed(3), speed, dmg, range }; return fire(x, y, ang, speed, dmg, range, opts); };
    gs.events.on('shooter-fire', (s, a) => {
      const bolt = parked; parked = null;
      shots.push({ tick, id: id(s), type: s.enemyType, elite: !!s._elite, tex: s.texture.key, ang: +a.toFixed(6), x: +s.x.toFixed(3), y: +s.y.toFixed(3), r: s.cfg.radius, ...bolt });
    });
    const k = gs.keys;
    for (; tick < 900; tick++) {
      const ph = Math.floor(tick / 90) % 4;
      k.A.isDown = ph === 0; k.D.isDown = ph === 2; k.W.isDown = ph === 1; k.S.isDown = ph === 3;
      if (tick > 450 && tick % 9 === 0) gs.player.keyboardFire();
      window.__adv(1);
      for (const e of gs.enemies.getChildren()) if (e.enemyType === 'sniper' && e.active && e.laser?.active) lasers.push(`${tick}:${id(e)}:${e._charging ? 1 : 0}:${e._chargeMs?.toFixed?.(2)}:${e.laser.commandBuffer.map((v) => (typeof v === 'number' ? +v.toFixed(3) : v)).join(',')}`);
      if (tick % 15 === 14) {
        snaps.push(gs.enemies.getChildren().filter((e) => e.active).map((e) => `${id(e)}:${e.enemyType}:${e.x.toFixed(3)},${e.y.toFixed(3)},${e.body.velocity.x.toFixed(2)},${e.body.velocity.y.toFixed(2)},${e.hp},${e.state},${e._aim.toFixed(4)},${e.fireCd?.toFixed?.(2)},${e._chargeMs?.toFixed?.(2)},${e.alive}`).join('|')
          + `#P${gs.player.x.toFixed(3)},${gs.player.y.toFixed(3)}#B${gs.enemyBullets.getChildren().filter((b) => b.active).map((b) => `${b.x.toFixed(2)},${b.y.toFixed(2)}`).join(';')}#R${window.__draws}`);
      }
    }
    return { shots, snaps, lasers, kills: [...ids.keys()].filter((e) => !e.alive).length };
  });
  await page.close();
  return r;
}
const nL = await nest('');
const nV = await nest('&roster=v1');
const d = nL.snaps.findIndex((s, i) => s !== nV.snaps[i]);
check(nL.snaps.length === 60 && d === -1,
  'seeded SNIPER NEST, 900 ticks (Rifleman on v2.2 both sides): legacy and v1 are the SAME FIGHT — positions, velocity, hp, AI, aim, cooldowns, sniper charge, bolts, every random draw, 60 checkpoints',
  d < 0 ? '' : `first divergence at ${d}\nL ${nL.snaps[d]?.slice(0, 300)}\nV ${nV.snaps[d]?.slice(0, 300)}`);
const sh = (r) => JSON.stringify(r.shots.map(({ tex, ...s }) => s));
const sn = nV.shots.filter((s) => s.type === 'sniper'), gr = nV.shots.filter((s) => s.type === 'grunt');
check(sh(nL) === sh(nV) && sn.length >= 3 && gr.length >= 3, `the same ${sn.length} Marksman and ${gr.length} Rifleman shots, same ticks, same bodies, same angles, same speed/damage/range`, `${nL.shots.length} vs ${nV.shots.length}`);
check(nV.shots.every((s) => Math.abs(Math.hypot(s.bx - s.x, s.by - s.y) - (s.r + 4)) < 0.01), 'every bolt spawned cfg.radius + 4 from its body (the frozen spawn point)', '');
const tiers = new Set(nV.shots.map((s) => s.tex));
check(['ro-rif-R', 'ro-mrk-R'].every((t) => tiers.has(t)), `(not vacuous) v1 shots came from the production art: ${[...tiers].join(', ')}`, '');
const ld = nL.lasers.findIndex((s, i) => s !== nV.lasers[i]);
check(nL.lasers.length === nV.lasers.length && ld === -1 && nV.lasers.some((s) => s.split(':')[2] === '1'),
  `the sniper LASER TELEGRAPH draws identical commands on every one of ${nV.lasers.length} sniper-ticks (tracking and lock)`, ld < 0 ? '' : `${nL.lasers[ld]?.slice(0, 200)} vs ${nV.lasers[ld]?.slice(0, 200)}`);

// ── cleanup leaves no 2B art behind ────────────────────────────────────────
const pC = await stepped('?nodlg=1&nofreeze=1&roster=v1');
const clean = await pC.evaluate(() => {
  const gs = window.__gs;
  const count = () => gs.children.list.filter((o) => o.active && o.texture && /^ro-(w-)?(rif|mrk)-/.test(o.texture.key)).length;
  const r = { start: count() };
  const a = gs.spawnEnemyAt('grunt', 700, 700, {}), b = gs.spawnEnemyAt('sniper', 900, 700, { elite: true });
  window.__adv(1); r.alive = count();
  a.damage(1e6); b.damage(1e6); window.__adv(90); r.afterDeath = count();
  for (let i = 0; i < 4; i++) gs.spawnEnemyAt(i % 2 ? 'sniper' : 'grunt', 600 + i * 120, 900, i > 1 ? { elite: true } : {});
  window.__adv(1); gs._clearRoomEntities(); window.__adv(5); r.afterClear = count();
  r.fxLeft = gs.__rosterFx ? [...gs.__rosterFx].length : 0;
  return r;
});
await pC.close();
// (the room's own opening Riflemen / Marksmen are part of `start`, and the
// room clear rightly takes them too — so after the clear the count is zero)
check(clean.alive >= clean.start + 4 && clean.afterDeath === clean.start && clean.afterClear === 0 && clean.fxLeft === 0,
  'death and room clear leave no Rifleman / Marksman body, weapon or firing cycle behind', JSON.stringify(clean));

// ── frozen guards ──────────────────────────────────────────────────────────
{
  const run = (cmd) => execSync(cmd, { cwd: ROOT, encoding: 'utf8' });
  const frozen = ['src/entities/ShockCaptain.js', 'src/systems/Hazard.js', 'src/data/champions.js', 'src/systems/pixelArt.js'];
  check(run(`git diff --stat 6560c62 -- ${frozen.join(' ')}`).trim() === '', 'Captain actor, grenade, champions data and pixelArt.js unchanged since 6560c62', '');
  const base = (src) => { const a = src.indexOf('export class Enemy extends'); return src.slice(0, src.indexOf('\nexport class ', a + 10)); };
  check(base(run('git show 6560c62:src/entities/Enemy.js')) === base(readFileSync(ROOT + 'src/entities/Enemy.js', 'utf8')), 'the Enemy BASE CLASS is byte-identical to 6560c62', '');
  check(run('git diff --stat 3ce5680 -- src/systems/gunnerMuzzle.js src/entities/Enemy.js src/data/encounters.js').trim() === '',
    'Gunner fire v5, every enemy class (incl. v2.2 movement and the sniper AI) and the encounter table unchanged since the approved 3ce5680', '');
}

await browser.close();
let bad = 0;
for (const c of checks) { console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.label}${c.ok ? '' : `  [${c.detail}]`}`); if (!c.ok) bad++; }
console.log(`\n${checks.length - bad}/${checks.length} checks passed`);
process.exit(bad ? 1 : 0);
