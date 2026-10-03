// ROSTER PHASE 2A — THE GUNNER (internal `shooter`) ON ITS PRODUCTION ART.
//
// Objective checks only. Whether the Gunner reads, whether the elite looks
// better issued, whether the Captain still sits on top — those are the
// handset's, and nothing here pretends to answer them.
//
// What this file pins:
//   - under `?roster=v1` the Gunner, and ONLY the Gunner, wears `ro-gun-R` /
//     `ro-gun-E` and `ro-w-gun-R` / `ro-w-gun-E`, on the stock 33-frame / 18-key
//     contract; shielded, sniper, swarmling and every nemesis stay legacy;
//   - legacy (no flag) is the `88e9b89` Gunner, against the Phase 1 fixture;
//   - every gameplay value the Gunner has is identical under both flags — and
//     then, beyond the field list, that a SEEDED, HAND-STEPPED CROSSFIRE runs
//     the same fight in both (positions, hp, AI state, every shot's tick,
//     origin, speed, damage and range, every random draw);
//   - the drawn muzzle is on the bolt's axis at every bearing and sits where
//     the bolt's leading edge is on the first frame it is drawn;
//   - baked palette: no tint is needed or kept, a hit flash and LIGHTS OUT
//     leave it alone, and death / room cleanup leave no Gunner art behind.
//
// usage: node tests/smoke-roster-gunner.mjs

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const BASE = 'http://localhost:5173/';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const FIXTURE = new URL('./fixtures/roster-legacy-88e9b89.json', import.meta.url).pathname;
const ROOT = new URL('..', import.meta.url).pathname;
const hist = JSON.parse(readFileSync(FIXTURE, 'utf8'));

const checks = [];
const check = (ok, label, detail) => { checks.push({ ok: !!ok, label, detail }); };
const fail = (m) => { console.error(`FAIL: ${m}`); process.exit(1); };

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-setuid-sandbox'] });

// A SEEDED, HAND-STEPPED SESSION. The loop is slept and stepped at 1000/60;
// `Date.now` is stepped with it because Phaser's tween manager measures its
// delta off the wall clock (with a live clock a hand-stepped loop runs every
// tween — the spawn telegraphs among them — at the box's own speed, and two
// identical sessions diverge at the first spawn); `Math.random` is seeded.
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
    window.Phaser?.Math?.RND?.sow?.(['crix-gunner']);
    window.__t = 100000;
    Date.now = () => window.__t;
    window.__adv = (n = 1) => { for (let i = 0; i < n; i++) { window.__t += 1000 / 60; g.step(window.__t, 1000 / 60); } };
    g.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 4242 });
    window.__adv(2);
    const url = performance.getEntriesByType('resource').map((r) => r.name).find((n) => /systems\/debug\.js/.test(n));
    window.__dbg = await import(url);
    window.__dbg.setGodMode(true);
    window.__gs = g.scene.getScene('Game');
    for (let i = 0; i < 300 && !window.__gs.roomSpec; i++) window.__adv(1);
    window.__adv(20);
  });
  return page;
}

// Everything gameplay-relevant about one spawned unit, and how it looks.
const UNIT = () => {
  window.__unit = (type, spec = {}) => {
    const gs = window.__gs;
    const e = gs.spawnEnemyAt(type, 900, 900, spec);
    e.body.updateFromGameObject?.();
    const r = {
      play: {
        hp: e.hp, hpMax: e.hpMax, radius: e.cfg.radius, speed: e.cfg.speed,
        bodyW: e.body.width, bodyHalf: e.body.halfWidth,
        bodyDx: +(e.body.center.x - e.x).toFixed(3), bodyDy: +(e.body.center.y - e.y).toFixed(3),
        gunDist: e.weaponSprite ? e.cfg.radius - 4 : null, muzzleDist: e.cfg.radius + 4,
        shieldHalf: e._shieldHalfArc ?? null, shieldTurn: e._shieldTurnRate ?? null,
        elite: !!e._elite, rusher: e._isRusher ?? null,
      },
      look: {
        tex: e.texture.key, prefix: e._animPrefix, scale: +e.scaleX.toFixed(4), baseScale: e._baseScale,
        tint: e.tintTopLeft, tinted: e.isTinted, weapon: e.weaponSprite?.texture?.key ?? null,
        wOrigin: e.weaponSprite ? [+e.weaponSprite.originX.toFixed(4), +e.weaponSprite.originY.toFixed(4)] : null,
        fireCd: e.cfg.fireCooldownMs, bSpeed: e.cfg.bulletSpeed, bDmg: e.cfg.bulletDamage, bRange: e.cfg.bulletRange,
      },
    };
    gs._destroyEnemyFully(e);
    return r;
  };
};

// ── LEGACY and V1, unit by unit ───────────────────────────────────────────
const pL = await stepped('?nodlg=1&nofreeze=1');
await pL.evaluate(UNIT);
const L = await pL.evaluate(() => ({
  R: window.__unit('shooter'), E: window.__unit('shooter', { elite: true }),
  shielded: window.__unit('shielded'), sniper: window.__unit('sniper'),
}));
const pV = await stepped('?nodlg=1&nofreeze=1&roster=v1');
await pV.evaluate(UNIT);
const V = await pV.evaluate(() => ({
  R: window.__unit('shooter'), E: window.__unit('shooter', { elite: true }),
  shielded: window.__unit('shielded'), sniper: window.__unit('sniper'), swarmling: window.__unit('swarmling'),
  shieldedE: window.__unit('shielded', { elite: true }), sniperE: window.__unit('sniper', { elite: true }),
}));

const strip = ({ rusher, ...p }) => p;
// 6. legacy is 88e9b89
for (const [k, h] of [['R', 'shooter'], ['E', 'shooter+E']]) {
  check(JSON.stringify(strip(hist.units[h].play)) === JSON.stringify(strip(L[k].play)), `6. legacy Gunner ${k}: gameplay identical to 88e9b89`, JSON.stringify(L[k].play));
  const { tinted, wOrigin, fireCd, bSpeed, bDmg, bRange, ...look } = L[k].look;
  check(JSON.stringify(hist.units[h].look) === JSON.stringify(look), `6. legacy Gunner ${k}: presentation identical to 88e9b89`, JSON.stringify(look));
}
check(JSON.stringify(L.R.look.wOrigin) === '[0.15,0.5]' && JSON.stringify(L.E.look.wOrigin) === '[0.15,0.5]', '6. legacy Gunner weapon origin is still (0.15, 0.5)', JSON.stringify(L.R.look.wOrigin));
// 1-3. v1 art
check(V.R.look.tex === 'ro-gun-R' && V.R.look.prefix === 'ro-gun-R', '1. v1 REGULAR Gunner wears ro-gun-R (texture + animation prefix)', JSON.stringify(V.R.look));
check(V.E.look.tex === 'ro-gun-E' && V.E.look.prefix === 'ro-gun-E', '2. v1 ELITE Gunner wears ro-gun-E (texture + animation prefix)', JSON.stringify(V.E.look));
check(V.R.look.weapon === 'ro-w-gun-R' && V.E.look.weapon === 'ro-w-gun-E', '3. v1 weapon art attached: ro-w-gun-R / ro-w-gun-E', `${V.R.look.weapon} / ${V.E.look.weapon}`);
// 7-10. gameplay identical to legacy (and so to the fixture)
for (const k of ['R', 'E']) {
  const a = L[k].play, b = V[k].play;
  check(a.hp === b.hp && a.hpMax === b.hpMax, `7. Gunner ${k} hp unchanged under v1 (${b.hp})`, `${a.hp} vs ${b.hp}`);
  check(a.speed === b.speed, `8. Gunner ${k} speed unchanged under v1 (${b.speed})`, `${a.speed} vs ${b.speed}`);
  check(a.radius === b.radius && a.bodyW === b.bodyW && a.bodyHalf === b.bodyHalf && b.bodyDx === 0 && b.bodyDy === 0,
    `9. Gunner ${k} collision unchanged: cfg.radius ${b.radius}, body ${b.bodyW}px, centred`, `${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
  check(a.gunDist === b.gunDist && a.muzzleDist === b.muzzleDist, `13. Gunner ${k} weapon origin (${b.gunDist}) and gameplay spawn distance (${b.muzzleDist}) unchanged`, '');
  check(L[k].look.fireCd === V[k].look.fireCd && L[k].look.bSpeed === V[k].look.bSpeed && L[k].look.bDmg === V[k].look.bDmg && L[k].look.bRange === V[k].look.bRange,
    `11/12. Gunner ${k} cadence ${V[k].look.fireCd}ms, bolt ${V[k].look.bSpeed}px/s, ${V[k].look.bDmg} dmg, ${V[k].look.bRange}px range — unchanged`, '');
  check(b.rusher === false, `14. Gunner ${k} _isRusher is false`, String(b.rusher));
}
check(V.E.play.bodyW === hist.units['shooter+E'].play.bodyW && V.E.play.bodyW === 84 && V.E.look.scale === 1 && V.E.look.baseScale === 1,
  '10. v1 ELITE keeps the HISTORICAL physics footprint (84px) while rendering at scale 1.0', JSON.stringify({ ...V.E.play, scale: V.E.look.scale }));
// shared-sheet roles are untouched
for (const k of ['shielded', 'sniper']) {
  check(JSON.stringify(L[k]) === JSON.stringify(V[k]) && V[k].look.tex === 'shooter',
    `${k} still wears the legacy 'shooter' sheet under v1, gameplay identical (Gunner only)`, JSON.stringify(V[k].look));
}
check(V.shieldedE.look.tex === 'shooter' && V.sniperE.look.tex === 'shooter' && V.sniperE.look.scale === 1.4,
  'shielded / sniper ELITES keep legacy presentation under v1', `${V.shieldedE.look.tex} ${V.sniperE.look.tex} ${V.sniperE.look.scale}`);
check(V.swarmling.look.tex === 'grunt' && V.swarmling.look.scale === 0.7, 'swarmling still the legacy grunt sheet at 0.7', JSON.stringify(V.swarmling.look));

// ── 4/5. THE SHEET CONTRACT ───────────────────────────────────────────────
const sheet = await pV.evaluate(() => {
  const gs = window.__gs;
  const out = {};
  for (const key of ['ro-gun-R', 'ro-gun-E']) {
    const tex = gs.textures.get(key);
    const names = tex.getFrameNames().filter((n) => n !== '__BASE').map(Number).sort((a, b) => a - b);
    const src = tex.getSourceImage();
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    const x = c.getContext('2d'); x.drawImage(src, 0, 0);
    const fw = 96, fh = 104;
    const hashes = [], empty = [], clipped = [];
    for (let f = 0; f < 33; f++) {
      const d = x.getImageData(f * fw, 0, fw, fh).data;
      let h = 2166136261, n = 0;
      for (let i = 0; i < d.length; i++) { h ^= d[i]; h = Math.imul(h, 16777619) >>> 0; }
      for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
      hashes.push(h); if (!n) empty.push(f);
      // nothing but OUTLINE may touch the frame border: any other colour there
      // means a part of the figure ran off the canvas and was clipped
      for (let px = 0; px < fw * fh; px++) {
        const X = px % fw, Y = Math.floor(px / fw);
        if (X > 3 && X < fw - 4 && Y > 3 && Y < fh - 4) continue;
        const i = px * 4;
        if (d[i + 3] && !(d[i] === 6 && d[i + 1] === 7 && d[i + 2] === 10)) { clipped.push(f); break; }
      }
    }
    const fr = tex.get(0);
    // animation keys
    const want = [];
    ['front', 'back', 'side'].forEach((dir, di) => {
      const off = di * 8;
      want.push([`${key}-idle-${dir}`, [off]], [`${key}-walk-${dir}`, [1, 2, 3, 4, 5, 6].map((k) => off + k)], [`${key}-fire-${dir}`, [off + 7]]);
      ['raise', 'thrust', 'recoil'].forEach((p, pi) => want.push([`${key}-${p}-${dir}`, [24 + di * 3 + pi]]));
    });
    const bad = want.filter(([k, frames]) => {
      const a = gs.anims.get(k);
      return !a || a.frames.length !== frames.length || a.frames.some((af, i) => af.textureKey !== key || +af.textureFrame !== frames[i]);
    }).map(([k]) => k);
    const walkDistinct = [0, 8, 16].every((o) => new Set(hashes.slice(o + 1, o + 7)).size >= 4);
    const fireDistinct = [0, 8, 16].every((o) => hashes[o + 7] !== hashes[o]);
    out[key] = { frames: names.length, contiguous: names.every((n, i) => n === i), fw: fr.width, fh: fr.height, empty, clipped, keys: want.length - bad.length, bad, walkDistinct, fireDistinct };
  }
  return out;
});
for (const key of ['ro-gun-R', 'ro-gun-E']) {
  const s = sheet[key];
  check(s.frames === 33 && s.contiguous && s.fw === 96 && s.fh === 104 && !s.empty.length,
    `4. ${key}: 33 frames, 0-32, each 96x104 (24x26 @4), none empty`, JSON.stringify(s));
  check(!s.clipped.length, `4. ${key}: nothing but outline touches any frame border (no limb clipped by the canvas)`, JSON.stringify(s.clipped));
  check(s.walkDistinct && s.fireDistinct, `4. ${key}: each facing's 6 walk frames are a real cycle and its fire frame differs from idle`, JSON.stringify(s));
  check(s.keys === 18 && !s.bad.length, `5. ${key}: all 18 animation keys exist and point at the right frames of the right sheet`, JSON.stringify(s.bad));
}

// ── 22. MUZZLE: on the bolt's axis, at the bolt's first drawn leading edge ──
const muzzle = await pV.evaluate(() => {
  const gs = window.__gs;
  gs.arenaActive = false;
  for (const e of gs.enemies.getChildren().slice()) gs._destroyEnemyFully(e);
  const rows = [];
  for (const elite of [false, true]) for (let k = 0; k < 8; k++) {
    const aim = -Math.PI + k * Math.PI / 4;
    gs.enemyBullets.getChildren().forEach((b) => b.disableBody?.(true, true));
    const X = 700, Y = 700;
    const e = gs.spawnEnemyAt('shooter', X, Y, elite ? { elite: true } : {});
    e._performing = true; e._movePlanted = true; e._aim = aim;
    window.__adv(1);
    const ws = e.weaponSprite;
    const c = Math.cos(aim), s = Math.sin(aim);
    const tip = new window.Phaser.Math.Vector2(), rear = new window.Phaser.Math.Vector2();
    ws.getWorldTransformMatrix().transformPoint((1 - ws.originX) * ws.width, 0, tip);
    ws.getWorldTransformMatrix().transformPoint(-ws.originX * ws.width, 0, rear);
    gs.fireShooter(e, aim);
    const b = gs.enemyBullets.getChildren().find((q) => q.active);
    const along = (q) => (q.x - X) * c + (q.y - Y) * s, perp = (q) => -(q.x - X) * s + (q.y - Y) * c;
    const spawn = along(b), spawnPerp = perp(b);
    window.__adv(1);
    rows.push({ elite, deg: Math.round(aim * 180 / Math.PI), radius: e.cfg.radius, tip: along(tip), tipPerp: perp(tip), rear: along(rear),
      spawn, spawnPerp, lead: along(b) + b.displayWidth / 2, flipY: ws.flipY });
    gs._destroyEnemyFully(e);
  }
  return rows;
});
const offAxis = muzzle.filter((r) => Math.abs(r.tipPerp) > 0.5 || Math.abs(r.spawnPerp) > 0.5);
check(muzzle.length === 16 && !offAxis.length, '22. drawn muzzle AND gameplay spawn lie on the bolt axis at 8 bearings x 2 tiers (incl. the flipped west)', JSON.stringify(offAxis));
check(muzzle.some((r) => r.flipY) && muzzle.some((r) => !r.flipY), '22. the bearing set exercises the west flipY', '');
const lead = muzzle.filter((r) => Math.abs(r.tip - r.lead) > 1.5);
check(!lead.length, '22. the drawn muzzle sits at the bolt\'s leading edge on its first drawn frame (±1.5px), both tiers', JSON.stringify(lead.slice(0, 2)));
const inside = muzzle.filter((r) => !(r.rear < r.spawn && r.spawn < r.tip));
check(!inside.length, '22. the gameplay spawn point is INSIDE the drawn gun (behind the muzzle, ahead of the butt)', JSON.stringify(inside.slice(0, 2)));
check(muzzle.every((r) => r.rear >= -12.5), '22. the gun never reaches more than 12px behind the body centre (the visor stays clear when aimed at the camera)', JSON.stringify(muzzle.map((r) => +r.rear.toFixed(1))));

// ── 23. the pre-fire warning tint carries at least what it carried on legacy ─
const warn = await pV.evaluate(() => {
  const st = (k) => {
    const src = window.__gs.textures.get(k).getSourceImage();
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    const x = c.getContext('2d'); x.drawImage(src, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data;
    let shift = 0;   // what the 0xff6010 multiply takes off green: the visible hue change, summed over the gun
    for (let i = 0; i < d.length; i += 4) if (d[i + 3]) shift += d[i] - d[i + 1] * 0x60 / 255;
    return Math.round(shift);
  };
  return { legacy: st('wpn-enemy-rifle'), R: st('ro-w-gun-R'), E: st('ro-w-gun-E') };
});
check(warn.R >= warn.legacy && warn.E >= warn.legacy, '23. the 300ms pre-fire warning tint changes at least as much of the v1 gun as of the legacy one', JSON.stringify(warn));

// ── 18. NO TINT DEPENDENCY: baked palette survives a hit flash ─────────────
const tint = await pV.evaluate(() => {
  const gs = window.__gs;
  const hash = (key) => {
    const src = gs.textures.get(key).getSourceImage();
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    const x = c.getContext('2d'); x.drawImage(src, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data;
    let h = 2166136261; for (let i = 0; i < d.length; i++) { h ^= d[i]; h = Math.imul(h, 16777619) >>> 0; } return h;
  };
  const before = { R: hash('ro-gun-R'), E: hash('ro-gun-E'), wR: hash('ro-w-gun-R'), wE: hash('ro-w-gun-E') };
  const out = {};
  for (const [k, spec] of [['R', {}], ['E', { elite: true }]]) {
    const e = gs.spawnEnemyAt('shooter', 800, 800, spec);
    window.__adv(1);
    const a = { tinted: e.isTinted, w: e.weaponSprite.isTinted };
    e.damage(1);                    // the real hit path: enemy-hit -> fx.hitFlash -> setTintFill / clearTint
    window.__adv(20);
    out[k] = { spawn: a, afterHit: { tinted: e.isTinted, tint: e.tintTopLeft, w: e.weaponSprite.isTinted }, tex: e.texture.key };
    gs._destroyEnemyFully(e);
  }
  const after = { R: hash('ro-gun-R'), E: hash('ro-gun-E'), wR: hash('ro-w-gun-R'), wE: hash('ro-w-gun-E') };
  return { out, same: JSON.stringify(before) === JSON.stringify(after) };
});
for (const k of ['R', 'E']) {
  const t = tint.out[k];
  check(!t.spawn.tinted && !t.spawn.w && !t.afterHit.tinted && t.afterHit.tint === 0xffffff && !t.afterHit.w && t.tex.startsWith('ro-gun-'),
    `18. v1 Gunner ${k}: no tint at spawn, none after a real hit + flash, still on its baked sheet`, JSON.stringify(t));
}
check(tint.same, '18. the baked sheets and guns are pixel-identical after combat', '');
check(L.E.look.tinted && L.E.look.tint === 0xffd040, '18. (A/B) legacy elite really is tinted gold — the check above can fail', JSON.stringify(L.E.look));

// ── hp bar keeps its legacy colour (the base class keys it off the prefix) ─
const bar = await pV.evaluate(() => {
  const gs = window.__gs;
  const e = gs.spawnEnemyAt('shooter', 800, 800, {});
  e.hp = Math.round(e.hpMax * 0.3);
  window.__adv(1);
  const cols = new Set(e.hpBar.commandBuffer.filter((v) => typeof v === 'number' && v > 255));
  const r = { prefix: e._animPrefix, barPrefix: e._barPrefix, cyan: cols.has(0x00bbff), red: cols.has(0xee2020) };
  gs._destroyEnemyFully(e);
  return r;
});
check(bar.prefix === 'ro-gun-R' && bar.cyan && !bar.red, 'v1 Gunner hp bar keeps the legacy Gunner cyan (it is keyed off the prefix in the frozen base class)', JSON.stringify(bar));

// ── nemesis on a Gunner base stays legacy ──────────────────────────────────
const nem = await pV.evaluate(async () => {
  const gs = window.__gs;
  const url = performance.getEntriesByType('resource').map((r) => r.name).find((n) => /data\/nemesis\.js/.test(n));
  const { rollNemesis } = await import(url);
  const n = gs._spawnMiniBoss(rollNemesis(8, { base: 'shooter' }));
  window.__adv(1);
  const r = { base: n._nemesis?.base, tex: n.texture.key, prefix: n._animPrefix, weapon: n.weaponSprite?.texture?.key, wox: n.weaponSprite?.originX, scale: +n.scaleX.toFixed(3) };
  gs._destroyEnemyFully(n);
  return r;
});
check(nem.base === 'shooter' && nem.tex.startsWith('nem-') && !String(nem.weapon).startsWith('ro-') && nem.wox !== undefined && !String(nem.prefix).startsWith('ro-'),
  'a nemesis on the shooter base keeps its legacy nemesis presentation under v1', JSON.stringify(nem));

// ── 19. DEATH and ROOM CLEANUP leave no Gunner art behind ──────────────────
const clean = await pV.evaluate(() => {
  const gs = window.__gs;
  const count = () => gs.children.list.filter((o) => o.active && o.texture && /^ro-(w-)?gun-/.test(o.texture.key)).length;
  const r = { start: count() };
  const a = gs.spawnEnemyAt('shooter', 700, 700, {}), b = gs.spawnEnemyAt('shooter', 900, 700, { elite: true });
  window.__adv(1);
  r.alive = count();
  a.damage(1e6); b.damage(1e6);
  window.__adv(90);                               // corpse slide + fade (~350ms + fade)
  r.afterDeath = count();
  for (let i = 0; i < 3; i++) gs.spawnEnemyAt('shooter', 600 + i * 120, 900, i ? { elite: true } : {});
  window.__adv(1);
  r.beforeClear = count();
  gs._clearRoomEntities();
  window.__adv(5);
  r.afterClear = count();
  return r;
});
check(clean.alive === clean.start + 4, '19. (A/B) two live v1 Gunners put exactly 2 bodies + 2 guns on the display list', JSON.stringify(clean));
check(clean.afterDeath === clean.start, '19. after death no Gunner body or weapon sprite is left behind', JSON.stringify(clean));
check(clean.beforeClear === clean.start + 6 && clean.afterClear === clean.start, '19. a room clear removes every Gunner body and weapon sprite', JSON.stringify(clean));

// ── 20. LIGHTS OUT cannot reach the baked palette ──────────────────────────
const lo = await pV.evaluate(() => {
  const gs = window.__gs;
  const e = gs.spawnEnemyAt('shooter', 700, 700, {}), f = gs.spawnEnemyAt('shooter', 900, 700, { elite: true });
  e._performing = f._performing = true;
  window.__adv(1);
  const state = () => [e, f].map((q) => `${q.isTinted ? q.tintTopLeft : 'clear'}/${q.weaponSprite.isTinted ? q.weaponSprite.tintTopLeft : 'clear'}/${q.texture.key}`).join(' ');
  const r = { before: state(), inLayer: gs.roomLayer.getChildren().includes(e) || gs.roomLayer.getChildren().includes(f) };
  gs._enterDarkArena();
  window.__adv(30);
  r.dark = state(); r.darkActive = !!gs._darkSnap;
  gs._exitDarkArena();
  window.__adv(60);
  r.after = state(); r.restored = !gs._darkSnap;
  gs._destroyEnemyFully(e); gs._destroyEnemyFully(f);
  return r;
});
check(lo.darkActive && lo.restored, '20. (A/B) LIGHTS OUT really engaged and really restored', JSON.stringify(lo));
check(!lo.inLayer && lo.before === lo.dark && lo.dark === lo.after && /clear\/clear\/ro-gun-R clear\/clear\/ro-gun-E/.test(lo.after),
  '20. LIGHTS OUT and its restore leave the v1 Gunners untinted on their baked sheets', JSON.stringify(lo));
await pL.close(); await pV.close();

// ── 11-13. THE SAME FIGHT: seeded CROSSFIRE, legacy vs v1, tick for tick ───
// Four Gunners lead, Gunner/Rifleman fill, sector 14 (elite roll 0.40). The
// player walks a fixed pattern and opens fire halfway, so the window has
// movement, facing changes, enemy fire, hits and kills in it.
async function crossfire(q) {
  const page = await stepped(`?nodlg=1&nofreeze=1&encdbg=crossfire&room=corridor&sector=14&wave=1${q}`);
  const r = await page.evaluate(() => {
    const gs = window.__gs;
    const ids = new Map(); let nid = 0;
    const id = (e) => { if (!ids.has(e)) ids.set(e, nid++); return ids.get(e); };
    const shots = [], snaps = [];
    let tick = 0;
    gs.events.on('shooter-fire', (s, a) => {
      if (s.enemyType !== 'shooter') return;
      shots.push({ tick, id: id(s), elite: !!s._elite, tex: s.texture.key, ang: +a.toFixed(6), x: +s.x.toFixed(3), y: +s.y.toFixed(3), r: s.cfg.radius });
    });
    const fire = gs.enemyBullets.fire.bind(gs.enemyBullets);
    gs.enemyBullets.fire = (x, y, ang, speed, dmg, range, opts) => {
      const last = shots[shots.length - 1];
      if (last && last.tick === tick && last.bx === undefined) Object.assign(last, { bx: +x.toFixed(3), by: +y.toFixed(3), speed, dmg, range });
      return fire(x, y, ang, speed, dmg, range, opts);
    };
    const k = gs.keys;
    for (; tick < 900; tick++) {
      const ph = Math.floor(tick / 90) % 4;
      k.A.isDown = ph === 0; k.D.isDown = ph === 2; k.W.isDown = ph === 1; k.S.isDown = ph === 3;
      if (tick > 450 && tick % 9 === 0) gs.player.keyboardFire();
      window.__adv(1);
      if (tick % 15 === 14) {
        snaps.push(gs.enemies.getChildren().filter((e) => e.active).map((e) => `${id(e)}:${e.enemyType}:${e.x.toFixed(3)},${e.y.toFixed(3)},${e.body.velocity.x.toFixed(2)},${e.body.velocity.y.toFixed(2)},${e.hp},${e.state},${e._aim.toFixed(4)},${e.fireCd?.toFixed?.(2)},${e.alive}`).join('|')
          + `#P${gs.player.x.toFixed(3)},${gs.player.y.toFixed(3)}#B${gs.enemyBullets.getChildren().filter((b) => b.active).map((b) => `${b.x.toFixed(2)},${b.y.toFixed(2)}`).join(';')}#R${window.__draws}`);
      }
    }
    const tex = [...ids.keys()].filter((e) => e.enemyType === 'shooter').map((e) => e.texture?.key ?? 'destroyed');
    return { shots, snaps, tex, kills: [...ids.keys()].filter((e) => !e.alive).length };
  });
  await page.close();
  return r;
}
const cL = await crossfire('');
const cV = await crossfire('&roster=v1');
const firstSnapDiff = cL.snaps.findIndex((s, i) => s !== cV.snaps[i]);
check(cL.snaps.length === 60 && firstSnapDiff === -1,
  '11-13. seeded CROSSFIRE, 900 ticks: legacy and v1 are the SAME FIGHT — every enemy position, velocity, hp, AI state, aim, cooldown, every bolt, every random draw, at 60 checkpoints',
  firstSnapDiff < 0 ? '' : `first divergence at checkpoint ${firstSnapDiff}\nL ${cL.snaps[firstSnapDiff]?.slice(0, 400)}\nV ${cV.snaps[firstSnapDiff]?.slice(0, 400)}`);
const sameShots = JSON.stringify(cL.shots.map(({ tex, ...s }) => s)) === JSON.stringify(cV.shots.map(({ tex, ...s }) => s));
check(sameShots && cL.shots.length > 10, `11. fire cadence: the same ${cV.shots.length} Gunner shots on the same ticks from the same bodies at the same angles`, `${cL.shots.length} vs ${cV.shots.length}`);
const eliteShots = cV.shots.filter((s) => s.tex === 'ro-gun-E').length, regShots = cV.shots.filter((s) => s.tex === 'ro-gun-R').length;
check(eliteShots > 0 && regShots > 0, `11. (not vacuous) v1 shots came from both production tiers: ${regShots} regular, ${eliteShots} elite`, JSON.stringify(cV.tex));
const badBolt = cV.shots.filter((s, i) => s.bx === undefined || s.speed !== cL.shots[i]?.speed || s.dmg !== cL.shots[i]?.dmg || s.range !== cL.shots[i]?.range);
const spawnOff = cV.shots.filter((s) => Math.abs(Math.hypot(s.bx - s.x, s.by - s.y) - (s.r + 4)) > 1e-3);
check(!badBolt.length, `12. every v1 Gunner bolt has the legacy speed / damage / range (${[...new Set(cV.shots.map((s) => `${s.speed}px/s ${s.dmg}dmg ${s.range}px`))].join(', ')})`, JSON.stringify(badBolt.slice(0, 2)));
check(!spawnOff.length, '13. every v1 Gunner bolt spawned exactly cfg.radius + 4 from its body (26 regular / 34 elite)', JSON.stringify(spawnOff.slice(0, 2)));
check(cV.kills > 0, `(not vacuous) the window contains kills: ${cV.kills}`, '');

// ── 15/16. the Captain and the Enemy base class are byte-identical ─────────
{
  const sh = (cmd) => execSync(cmd, { cwd: ROOT, encoding: 'utf8' });
  const frozen = ['src/entities/ShockCaptain.js', 'src/systems/Hazard.js', 'src/data/champions.js', 'src/systems/pixelArt.js'];
  const diff = sh(`git diff --stat 6560c62 -- ${frozen.join(' ')}`).trim();
  check(diff === '', '15. Captain actor, grenade, champions data and pixelArt.js unchanged since 6560c62', diff);
  const baseClass = (src) => { const a = src.indexOf('export class Enemy extends'); return src.slice(0, src.indexOf('\nexport class ', a + 10)); };
  check(baseClass(sh('git show 6560c62:src/entities/Enemy.js')) === baseClass(readFileSync(ROOT + 'src/entities/Enemy.js', 'utf8')),
    '16. the Enemy BASE CLASS is byte-identical to 6560c62', '');
}

await browser.close();
let bad = 0;
for (const c of checks) { console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.label}${c.ok ? '' : `  [${c.detail}]`}`); if (!c.ok) bad++; }
console.log(`\n${checks.length - bad}/${checks.length} checks passed`);
process.exit(bad ? 1 : 0);
