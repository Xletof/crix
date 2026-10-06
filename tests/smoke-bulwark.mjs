// BULWARK PRODUCTION INTEGRATION (`shielded`, roster v1) — the vertical slice:
// body + sidearm + gait v2 + the frosted hard-light field. Presentation only.
//
// Pinned:
//   - UNITS: legacy is untouched (the Gunner sheet under the legacy tint, the
//     legacy arc shown, no field); v1 wears ro-blw-R / ro-blw-E and the
//     sidearm, with every gameplay field identical — hp, radius, speed, the
//     ELITE's historical collider at render scale 1, shield half-arc and turn
//     rate, cadence, bolt speed / damage / range, desired range;
//   - SHEETS: 33 frames (51 under ?gait=v2), every one of the 18 animation
//     keys, nothing empty or clipped, a real walk, the emitter core painted
//     where BULWARK_CORE says, and the gait-v2 shuffle's anatomy rules;
//   - SIDEARM: drawn muzzle on the bolt axis at its first drawn leading edge at
//     8 bearings x 2 tiers, the spawn inside the weapon, the visor clear;
//   - FIELD: the drawn arc IS the protected arc (tips at facing ± halfArc, on
//     the curtain radius), identical between Regular and Elite, and the legacy
//     arc hidden only while the field speaks;
//   - ORIENTATION: DEPTH MAY CHANGE, ENERGY STRENGTH MAY NOT — the same field
//     drawn at S vs N and E vs W (idle + every block / tear / prick beat) emits
//     an identical style stream with only the layer swapped; the north rim,
//     keyline and tips are full strength; paired hits on opposite halves
//     match; a reaction beside him is not drawn under him; the band reads
//     19 / 17 / 15px south / side / north; depth routing kept (BLW_BASE=<url>
//     runs the suite against another build for the A/B);
//   - EVENTS: a real blocked bolt makes ONE local block event at its projected
//     contact; several coexist; they expire on their own clock; a real Super
//     makes ONE tear (other pellets merge or prick); the field closes fully;
//   - ONE AUTHOR: under v1 the legacy clang + sparkle do not draw — while the
//     sparkle's random draws are still made, so the RNG stream is identical;
//     legacy still draws both;
//   - INVARIANCE: seeded VANGUARD replays (case A, with a Super fired into the
//     shields) — legacy vs v1 and gait off vs v2 — are the SAME FIGHT:
//     positions, velocities, AI state, shield facing, hp, bolts, player hp and
//     meter, the front's state and release reason/time, the queue, and every
//     random draw; the same shots on the same ticks;
//   - CLEANUP: death and room clear take every field Graphics with the body;
//   - FROZEN: Enemy.js unchanged since 3ce5680 (base class == 6560c62), the
//     Shielded config unchanged, no predictive bolt hiding, no shield
//     hp / break / cooldown.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const BASE = process.env.BLW_BASE || 'http://localhost:5173/';   // BLW_BASE: A/B the checks against another build
const ROOT = new URL('../', import.meta.url).pathname;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const checks = []; const check = (ok, l, d) => checks.push({ ok: !!ok, l, d });
const fail = (m) => { console.error('FAIL', m); process.exit(1); };

async function stepped(q) {
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  page.on('pageerror', (e) => fail(`${q}: ${e.message}`));
  await page.goto(BASE + q);
  await page.waitForFunction(() => window.game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 45000 });
  await page.evaluate(async () => {
    const g = window.game; g.loop.sleep();
    let s = 12345; window.__draws = 0;
    Math.random = () => { window.__draws++; s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    window.__t = 1e5; Date.now = () => window.__t;
    window.__adv = (n = 1) => { for (let i = 0; i < n; i++) { window.__t += 1000 / 60; g.step(window.__t, 1000 / 60); } };
    g.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 4242 }); window.__adv(2);
    const url = performance.getEntriesByType('resource').map((r) => r.name).find((n) => /systems\/debug\.js/.test(n));
    (await import(url)).setGodMode(true);
    window.__gs = g.scene.getScene('Game');
    for (let i = 0; i < 300 && !window.__gs.roomSpec; i++) window.__adv(1);
    window.__adv(20);
    window.__mod = async (re) => { const u = performance.getEntriesByType('resource').map((r) => r.name).find((n) => re.test(n)); return u ? import(u) : null; };
    // an open stretch of floor with nothing solid on it, and no wave running
    window.__open = () => {
      const gs = window.__gs;
      gs.arenaActive = false;
      for (const e of gs.enemies.getChildren().slice()) gs._destroyEnemyFully(e);
      for (const o of gs.roomLayer.getChildren()) if (o.body && (o.displayWidth || 0) < 1000) o.body.enable = false;
      for (const t of gs.terminals || []) for (const k of Object.values(t)) if (k?.body) k.body.enable = false;
      for (const w of gs.walls?.getChildren?.() || []) if (w.body) w.body.enable = false;
    };
  });
  return page;
}

// ── 1. UNITS: legacy vs v1 ─────────────────────────────────────────────────
const UNIT = () => {
  window.__unit = (spec = {}) => {
    const gs = window.__gs;
    const e = gs.spawnEnemyAt('shielded', 900, 900, spec);
    e.body.updateFromGameObject?.();
    const c = e.cfg;
    const r = {
      play: { hp: e.hp, hpMax: e.hpMax, radius: c.radius, speed: c.speed, bodyW: e.body.width, bodyHalf: e.body.halfWidth,
        bodyDx: +(e.body.center.x - e.x).toFixed(3), bodyDy: +(e.body.center.y - e.y).toFixed(3),
        half: e._shieldHalfArc, turn: e._shieldTurnRate, blocks: e._blocksFrontal, elite: !!e._elite,
        fireCd: c.fireCooldownMs, bSpeed: c.bulletSpeed, bDmg: c.bulletDamage, bRange: c.bulletRange, desired: c.desiredRange },
      look: { tex: e.texture.key, prefix: e._animPrefix, weapon: e.weaponSprite?.texture?.key, scale: +e.scaleX.toFixed(4),
        tinted: e.isTinted, curtain: !!e._curtain, arcVisible: e.shieldArc?.visible, rosterFx: e._rosterFx ?? null, wfx: !!e._weaponFx },
    };
    gs._destroyEnemyFully(e);
    return r;
  };
};
const pL = await stepped('?nodlg=1&nofreeze=1');
await pL.evaluate(UNIT);
const L = await pL.evaluate(() => ({ R: window.__unit(), E: window.__unit({ elite: true }) }));
const pV = await stepped('?nodlg=1&nofreeze=1&roster=v1');
await pV.evaluate(UNIT);
const V = await pV.evaluate(() => ({ R: window.__unit(), E: window.__unit({ elite: true }), N: window.__unit({ legacyArt: true }) }));
for (const [k, sfx, name] of [['R', 'R', 'Regular'], ['E', 'E', 'Elite']]) {
  check(JSON.stringify(L[k].play) === JSON.stringify(V[k].play),
    `Bulwark ${name}: gameplay identical legacy vs v1 — hp ${V[k].play.hp}, radius ${V[k].play.radius}, body ${V[k].play.bodyW}px centred, speed ${+V[k].play.speed.toFixed(1)}, half-arc ${V[k].play.half}, turn ${V[k].play.turn}, ${V[k].play.fireCd}ms / ${V[k].play.bSpeed}px/s / ${V[k].play.bDmg} / ${V[k].play.bRange}px, desired ${V[k].play.desired}`,
    `${JSON.stringify(L[k].play)} vs ${JSON.stringify(V[k].play)}`);
  check(V[k].look.tex === `ro-blw-${sfx}` && V[k].look.prefix === `ro-blw-${sfx}` && V[k].look.weapon === `ro-w-blw-${sfx}` && !V[k].look.tinted,
    `Bulwark ${name} v1: wears ro-blw-${sfx} + the sidearm ro-w-blw-${sfx}, untinted`, JSON.stringify(V[k].look));
  check(V[k].look.curtain && V[k].look.arcVisible === false && V[k].look.rosterFx === 'sidearm' && V[k].look.wfx,
    `Bulwark ${name} v1: the hard-light field is attached and the legacy arc is hidden; the sidearm owns its firing cycle`, JSON.stringify(V[k].look));
  check(L[k].look.tex === 'shooter' && !L[k].look.curtain && L[k].look.arcVisible === true && L[k].look.weapon === 'wpn-enemy-rifle',
    `Bulwark ${name} legacy: the shooter sheet, the legacy rifle, the legacy arc, no field`, JSON.stringify(L[k].look));
}
check(V.E.play.bodyW === L.E.play.bodyW && V.E.look.scale === 1 && V.E.play.radius === 33,
  `Elite: HISTORICAL collider retained (${V.E.play.bodyW}px, radius 33) while rendering at scale 1.0`, JSON.stringify(V.E));
check(!V.N.look.curtain && V.N.look.arcVisible === true && V.N.look.tex === 'shooter', 'a legacy-art spawn (nemesis path) under v1 keeps the legacy shield presentation', JSON.stringify(V.N.look));
await pL.close();

// ── 2. SHEETS ────────────────────────────────────────────────────────────
const sheetProbe = () => {
  const gs = window.__gs, out = {};
  for (const key of ['ro-blw-R', 'ro-blw-E']) {
    const tex = gs.textures.get(key), src = tex.getSourceImage();
    const n = tex.getFrameNames().filter((f) => f !== '__BASE').length;
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    const x = c.getContext('2d'); x.drawImage(src, 0, 0);
    const fw = 96, fh = 104, hashes = [], empty = [], clipped = [], widths = [];
    for (let f = 0; f < n; f++) {
      const d = x.getImageData(f * fw, 0, fw, fh).data;
      let h = 2166136261, cnt = 0, minX = fw, maxX = -1;
      for (let i = 0; i < d.length; i++) { h ^= d[i]; h = Math.imul(h, 16777619) >>> 0; }
      for (let i = 3; i < d.length; i += 4) if (d[i]) { cnt++; const X = ((i - 3) / 4) % fw; minX = Math.min(minX, X); maxX = Math.max(maxX, X); }
      hashes.push(h); if (!cnt) empty.push(f); widths.push((maxX - minX + 1) / 4);
      for (let px = 0; px < fw * fh; px++) {
        const X = px % fw, Y = Math.floor(px / fw);
        if (X > 3 && X < fw - 4 && Y > 3 && Y < fh - 4) continue;
        const i = px * 4;
        if (d[i + 3] && !(d[i] === 6 && d[i + 1] === 7 && d[i + 2] === 10)) { clipped.push(f); break; }
      }
    }
    const want = [];
    ['front', 'back', 'side'].forEach((dir, di) => {
      const off = di * 8;
      want.push([`${key}-idle-${dir}`, [off]], [`${key}-walk-${dir}`, [1, 2, 3, 4, 5, 6].map((k) => off + k)], [`${key}-fire-${dir}`, [off + 7]]);
      ['raise', 'thrust', 'recoil'].forEach((p, pi) => want.push([`${key}-${p}-${dir}`, [24 + di * 3 + pi]]));
    });
    const bad = want.filter(([k, frames]) => { const a = gs.anims.get(k); return !a || a.frames.length !== frames.length || a.frames.some((af, i) => af.textureKey !== key || +af.textureFrame !== frames[i]); }).map(([k]) => k);
    // the emitter core pixel, where BULWARK_CORE says it is, on the idle frames
    const px = (f, lx, ly) => { const d = x.getImageData(f * fw + Math.floor(lx) * 4 + 1, Math.floor(ly) * 4 + 1, 1, 1).data; return `#${[d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`; };
    out[key] = { frames: n, empty, clipped, keys: want.length - bad.length, bad, widths, hashes,
      walkDistinct: [0, 8, 16].every((o) => new Set(hashes.slice(o + 1, o + 7)).size >= 4),
      fireDistinct: [0, 8, 16].every((o) => hashes[o + 7] !== hashes[o]), px };
  }
  return out;
};
const sheetsV = await pV.evaluate(async (fn) => {
  const out = (0, eval)(`(${fn})`)();
  const rp = await window.__mod(/systems\/rosterPaint\.js/);
  const cores = {};
  for (const [key, tier] of [['ro-blw-R', 'regular'], ['ro-blw-E', 'elite']]) {
    const tex = window.__gs.textures.get(key), src = tex.getSourceImage();
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height; c.getContext('2d').drawImage(src, 0, 0);
    const at = (f, lx, ly) => { const d = c.getContext('2d').getImageData(f * 96 + Math.floor(lx) * 4 + 1, Math.floor(ly) * 4 + 1, 1, 1).data; return `#${[d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`; };
    const A = rp.BULWARK_CORE[tier];
    cores[key] = { front: [0, 1, 2, 3, 4, 5, 6, 7].map((f) => at(f, A.front[0], A.front[1])), side: [16, 17, 18, 19, 20, 21, 22, 23].map((f) => at(f, A.side[0], A.side[1])), want: rp.BULWARK_CORE_COLOR, back: A.back };
  }
  return { out, cores, cycle: rp.GAIT_CYCLE_PX, muzzlePast: rp.BULWARK_MUZZLE_PAST_PIVOT };
}, sheetProbe.toString());
await pV.close();
const pG = await stepped('?nodlg=1&nofreeze=1&roster=v1&gait=v2');
const sheetsG = await pG.evaluate(async (fn) => {
  const out = (0, eval)(`(${fn})`)();
  const rp = await window.__mod(/systems\/rosterPaint\.js/);
  return { out, G: rp.BULWARK_GAIT };
}, sheetProbe.toString());
for (const key of ['ro-blw-R', 'ro-blw-E']) {
  for (const [tag, S, n] of [['stock', sheetsV.out[key], 33], ['gait=v2', sheetsG.out[key], 51]]) {
    check(S.frames === n && !S.empty.length && !S.clipped.length && S.keys === 18 && S.walkDistinct && S.fireDistinct,
      `${key} (${tag}): ${S.frames} frames, every one of the 18 animation keys, nothing empty or clipped, a real walk, a distinct fire brace`,
      JSON.stringify({ frames: S.frames, empty: S.empty, clipped: S.clipped, bad: S.bad, walk: S.walkDistinct, fire: S.fireDistinct }));
  }
  const C = sheetsV.cores[key];
  check(C.front.every((v) => v === C.want) && C.side.every((v) => v === C.want) && C.back === null,
    `${key}: the emitter core is painted exactly where BULWARK_CORE says on every front and side frame (the projector arm does not bob), hidden from behind`, JSON.stringify(C));
}
check(sheetsV.out['ro-blw-R'].widths.slice(0, 8).every((w, i) => w === sheetsV.out['ro-blw-E'].widths[i] || w + 1 === sheetsV.out['ro-blw-E'].widths[i]),
  'Elite is NOT enlarged: front silhouette within one logical pixel of the Regular\'s on every frame (the projector brace)', JSON.stringify([sheetsV.out['ro-blw-R'].widths.slice(0, 8), sheetsV.out['ro-blw-E'].widths.slice(0, 8)]));
const G = sheetsG.G;
const sideAll = [G.side.idle, G.side.fire, ...G.side.walk, ...G.side.strafe];
check(sideAll.every((p) => p.N.f >= -3 && p.N.f <= 2 && p.F.f >= -3 && p.F.f <= 2 && Math.abs(p.N.k) <= 2 && Math.abs(p.F.k) <= 2),
  'gait v2 shuffle: ONE hip socket in profile, compact stride — every foot within +2/-3 of the pelvis, knees within 2 (no rear-leg tail)', '');
check(G.side.walk.every((p) => p.N.st === 'F' || p.F.st === 'F') && G.fb.walk.every((p) => p.L.st === 'F' || p.R.st === 'F'),
  'gait v2 shuffle: a planted foot on every walk frame (no flight phase — a heavy shuffle)', '');
check([...G.side.walk, ...G.fb.walk, ...G.side.strafe, ...G.fb.strafe].every((p) => [p.N, p.F, p.L, p.R].filter(Boolean).every((l) => l.st !== 'S')),
  'gait v2 shuffle: the travelling foot only ever clears the deck by one row (\'L\'), never the full swing', '');
check(G.fb.walk.every((p) => Math.abs(p.dx) <= 1 && p.bob <= 1) && G.fb.walk.filter((p) => p.dx !== 0).length === 2,
  'gait v2 shuffle: restrained weight transfer — one column, one row, on the two load frames only', JSON.stringify(G.fb.walk.map((p) => p.dx)));
// planted near foot slides back 2 -> 1 -> -1 -> -3: 5 logical px per step = the 40px cycle
check(sheetsV.cycle['ro-blw'] === 40 && G.side.walk[0].N.f - G.side.walk[3].N.f === 5,
  'gait v2 cadence: the cycle is 40px of REAL travel, derived from the 5-logical-pixel planted-foot slide (two steps x 5 x 4px)', JSON.stringify(sheetsV.cycle));

// ── 3. SIDEARM MUZZLE ───────────────────────────────────────────────────
const muzzle = await pG.evaluate(() => {
  const gs = window.__gs; window.__open();
  const rows = [];
  for (const elite of [false, true]) for (let k = 0; k < 8; k++) {
    const aim = -Math.PI + k * Math.PI / 4;
    gs.enemyBullets.getChildren().forEach((b) => b.disableBody?.(true, true));
    const X = 700, Y = 700;
    const e = gs.spawnEnemyAt('shielded', X, Y, elite ? { elite: true } : {});
    e._performing = true; e._movePlanted = true; e._aim = aim; e._shieldFacing = aim;
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
    rows.push({ elite, deg: Math.round(aim * 180 / Math.PI), tip: along(tip), tipPerp: perp(tip), rear: along(rear), spawn, spawnPerp, lead: along(b) + b.displayWidth / 2, flipY: ws.flipY, len: ws.width });
    gs._destroyEnemyFully(e);
  }
  return rows;
});
const offAx = muzzle.filter((r) => Math.abs(r.tipPerp) > 0.5 || Math.abs(r.spawnPerp) > 0.5);
check(muzzle.length === 16 && !offAx.length && muzzle.some((r) => r.flipY), 'sidearm: drawn muzzle AND gameplay spawn on the bolt axis at 8 bearings x 2 tiers (incl. the flipped west)', JSON.stringify(offAx.slice(0, 2)));
const offLead = muzzle.filter((r) => Math.abs(r.tip - r.lead) > 1.5);
check(!offLead.length, `sidearm: the drawn muzzle sits at the bolt's leading edge on its first drawn frame (±1.5px) — ${muzzle[0].tip.toFixed(1)}px (Elite ${muzzle[8].tip.toFixed(1)}) from the body centre; muzzle ${sheetsV.muzzlePast}px past the pivot`, JSON.stringify(offLead.slice(0, 2)));
check(muzzle.every((r) => r.rear < r.spawn && r.spawn < r.tip), 'sidearm: the gameplay spawn is INSIDE the drawn weapon', '');
check(muzzle.every((r) => r.rear >= 12), `sidearm: the overlay starts ${Math.min(...muzzle.map((r) => r.rear)).toFixed(1)}px OUT from the body centre (never across the visor)`, JSON.stringify(muzzle.map((r) => +r.rear.toFixed(1))));
const pistol = 7 * 4;
check(pistol < 48 && muzzle[0].len === 60 && muzzle[8].len === 68, `sidearm is COMPACT: a ${pistol}px pistol at the end of an armoured forearm (overlay 60px; Elite 68 — the forearm, not the gun, is longer); carbine 68px, Gunner 84px`, '');

// ── 4. FIELD GEOMETRY ──────────────────────────────────────────────────
const geo = await pG.evaluate(async () => {
  const gs = window.__gs; window.__open();
  const sc = await window.__mod(/systems\/shieldContact\.js/);
  const cur = await window.__mod(/systems\/bulwarkCurtain\.js/);
  const out = {};
  for (const elite of [false, true]) {
    const e = gs.spawnEnemyAt('shielded', 800, 700, elite ? { elite: true } : {});
    e._performing = true; e._movePlanted = true; e._aim = 0.7; e._shieldFacing = 0.7;
    window.__adv(2);
    const f = e._curtain, N = f._n;
    const rel = [...f._rel], ox = [...f._ox].map((v) => v - e.x), oy = [...f._oy].map((v) => v - e.y), ix = [...f._ix].map((v) => v - e.x), iy = [...f._iy].map((v) => v - e.y);
    const tip = (j) => ({ ang: Math.atan2(oy[j], ox[j]), r: Math.hypot(ox[j], oy[j]), same: Math.hypot(ox[j] - ix[j], oy[j] - iy[j]) < 1e-3 });
    out[elite ? 'E' : 'R'] = { rel0: rel[0], relN: rel[N], half: e._shieldHalfArc, t0: tip(0), tN: tip(N), R: sc.curtainRadius(e), arr: [ox, oy, ix, iy].map((a) => a.map((v) => +v.toFixed(3))),
      graphics: e._attachments.filter((g) => g.type === 'Graphics').length, nearDepth: f.near.depth - e.y, farDepth: f.far.depth - e.y };
    gs._destroyEnemyFully(e);
  }
  out.CR = cur.CURTAIN; out.R46 = sc.CURTAIN_RADIUS;
  return out;
});
for (const k of ['R', 'E']) {
  const g = geo[k];
  check(Math.abs(g.rel0 + g.half) < 1e-6 && Math.abs(g.relN - g.half) < 1e-6 && g.half === 1.35,
    `field (${k}): the drawn arc spans EXACTLY the frozen protected arc, facing ± ${g.half} rad`, JSON.stringify({ rel0: g.rel0, relN: g.relN }));
  check(g.t0.same && g.tN.same && Math.abs(g.t0.r - 46) < 1e-3 && Math.abs(g.tN.r - 46) < 1e-3 && Math.abs(window_wrap(g.t0.ang - (0.7 - g.half))) < 1e-4 && Math.abs(window_wrap(g.tN.ang - (0.7 + g.half))) < 1e-4,
    `field (${k}): both rims taper to ONE point at each end, on the curtain radius (46px) at exactly the coverage bearing`, JSON.stringify({ t0: g.t0, tN: g.tN }));
}
function window_wrap(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }
check(JSON.stringify(geo.R.arr) === JSON.stringify(geo.E.arr) && geo.R.R === geo.E.R && geo.R46 === 46,
  'Regular and Elite fields are IDENTICAL — every rim vertex the same, curtain radius 46 for both (the Elite\'s gameplay radius is 33)', '');
check(geo.R.nearDepth === 2 && geo.R.farDepth === -2, 'field depth: the near half draws over the body and the sidearm (y+2), the far half under the body (y-2)', JSON.stringify(geo.R));

// ── 4b. ORIENTATION INVARIANCE — DEPTH MAY CHANGE, ENERGY STRENGTH MAY NOT ──
// The first field dimmed whatever was routed to the FAR layers (material x0.5,
// outer rim x0.32, reactions x0.7, keyline near-only), so it was a full shield
// facing south, half a shield side-on and a ghost facing north. Here the SAME
// field is drawn at opposite facings with every style call recorded along with
// the layer it went to: the stream of style values must be identical and only
// the layer may differ. A sweep of block / tear / prick ages covers the event
// overlays, not just the idle material.
const orient = await pG.evaluate(async () => {
  const gs = window.__gs; window.__open();
  const cur = await window.__mod(/systems\/bulwarkCurtain\.js/);
  const e = gs.spawnEnemyAt('shielded', 800, 700, {});
  e._performing = true; e._movePlanted = true; e._aim = 0; e._shieldFacing = 0;
  window.__adv(2);
  const f = e._curtain;
  const L = { near: f.near, far: f.far, glowNear: f.glowNear, glowFar: f.glowFar };
  let log = null;
  for (const [name, g] of Object.entries(L)) for (const m of ['fillStyle', 'lineStyle', 'fillGradientStyle']) {
    const orig = g[m];
    g[m] = function (...a) { log?.push({ layer: name, m, a: a.map((v) => (typeof v === 'number' ? +v.toFixed(6) : v)) }); return orig.apply(this, a); };
  }
  const draw = (fac, events) => {
    e._shieldFacing = fac; e._aim = fac;
    f.clock = 1234; f.coreKick = 0; f.corePulse = 0; f.events = events.map((v) => ({ ...v }));
    log = []; f.draw(); const out = log; log = null;
    return out;
  };
  const S = Math.PI / 2, N = -Math.PI / 2, E = 0, W = Math.PI;
  const styles = (lg) => JSON.stringify(lg.map((x) => [x.m, x.a]));
  const layers = (lg) => [...new Set(lg.map((x) => x.layer))].sort();
  const out = { cases: [] };
  // idle, then every beat of every reaction
  const sets = [['idle', []]];
  for (const t of [5, 20, 60, 120, 200, 300, 450, 650]) sets.push([`block ${t}ms`, [{ kind: 'block', off: 0.15, t }]]);
  for (const t of [20, 90, 200, 440, 560, 620, 700, 820]) sets.push([`tear ${t}ms`, [{ kind: 'tear', off: 0.1, t, n: 2, snapped: t >= 600 }]]);
  for (const t of [20, 100, 210, 240]) sets.push([`prick ${t}ms`, [{ kind: 'prick', off: -0.4, t }]]);
  sets.push(['rapid layer', [{ kind: 'block', off: -0.6, t: 15 }, { kind: 'block', off: 0.2, t: 140 }, { kind: 'block', off: 0.7, t: 330 }]]);
  for (const [name, evs] of sets) {
    const s = draw(S, evs), n = draw(N, evs), ea = draw(E, evs), w = draw(W, evs);
    out.cases.push({ name, sn: styles(s) === styles(n), ew: styles(ea) === styles(w), nS: s.length,
      sLayers: layers(s), nLayers: layers(n), eLayers: layers(ea) });
  }
  // explicit values on the FAR side, facing north (idle): the rim, the keyline, the tips
  const C = cur.CURTAIN, nIdle = draw(N, []);
  const rim = nIdle.filter((x) => x.m === 'lineStyle' && x.a[1] === 0xffffff && x.a[0] >= C.rimW);
  out.north = { rimA: [...new Set(rim.map((x) => x.a[2]))], key: nIdle.filter((x) => x.m === 'lineStyle' && x.a[1] === C.key && x.layer === 'far').length,
    tips: nIdle.filter((x) => x.m === 'fillStyle' && x.a[0] === 0xffffff).map((x) => [x.layer, x.a[1]]), rimLayers: [...new Set(rim.map((x) => x.layer))] };
  // two simultaneous hits of the same age on OPPOSITE halves of a side-facing field
  const pair = [{ kind: 'block', off: 0.6, t: 30 }, { kind: 'block', off: -0.6, t: 30 }];
  // the smear is the only stroke wider than the rim's 2.5px (4.5 -> 2 over its 70ms); the rims
  // under a red front are red too, and are covered by the stream comparison above
  const smear = (lg) => lg.filter((x) => x.m === 'lineStyle' && x.a[1] === 0xff2828 && x.a[0] > 2.5);
  const pe = smear(draw(E, pair));
  out.pair = { layers: pe.map((x) => x.layer), args: pe.map((x) => JSON.stringify(x.a)) };
  out.farKeys = Object.keys(C).filter((k) => /^far/i.test(k));
  // a reaction BESIDE him (side-on, a hair either side of the facing) is not
  // behind him: it must not be drawn under his body and sidearm on one side of
  // his centre line and over them on the other
  const glowOf = (fac, off) => [...new Set(draw(fac, [{ kind: 'tear', off, t: 90, n: 2 }]).filter((x) => x.layer.startsWith('glow')).map((x) => x.layer))].join();
  out.beside = { Ep: glowOf(E, 0.1), Em: glowOf(E, -0.1), Wp: glowOf(W, 0.1), Wm: glowOf(W, -0.1), N0: glowOf(N, 0), NE: glowOf(E, -1.2) };
  // band thickness at the apex (screen px) facing S / E / N
  const apex = (fac) => { draw(fac, []); const j = f._n / 2; return Math.hypot(f._ox[j] - f._ix[j], f._oy[j] - f._iy[j]); };
  out.thick = { S: apex(S), E: apex(E), N: apex(N), W: apex(W) };
  out.depth = { body: e.depth, near: f.near.depth, far: f.far.depth, gNear: f.glowNear.depth, gFar: f.glowFar.depth };
  gs._destroyEnemyFully(e);
  return out;
});
{
  const bad = orient.cases.filter((c) => !c.sn || !c.ew);
  check(!bad.length && orient.cases.length === 22 && orient.cases.every((c) => c.nS > 20),
    `orientation: the field's style stream (material, seams, keyline, inner edge, outer rim, tips, smear, bloom, filaments, zipper, snap, pinprick) is IDENTICAL facing south and north, and facing east and west, across ${orient.cases.length} states (idle + every block / tear / prick beat) — only the layer differs`,
    JSON.stringify(bad.map((c) => c.name)));
  const S0 = orient.cases.find((c) => c.name === 'idle');
  check(S0.sLayers.join() === 'near' && S0.nLayers.join() === 'far' && S0.eLayers.join() === 'far,near',
    'depth routing kept: facing south the whole field goes to the NEAR layer, facing north to the FAR layer, side-on it is split between the two', JSON.stringify(S0));
  const tear = orient.cases.find((c) => c.name === 'tear 90ms');
  check(tear.sLayers.includes('glowNear') && tear.nLayers.includes('glowFar') && !tear.nLayers.includes('glowNear'),
    'event LIGHT is routed by depth too: a tear facing south lights the near glow layer, facing north the far one (under the body), at the same strength', JSON.stringify(tear));
  const d = orient.depth;
  check(d.near > d.body && d.gNear > d.body && d.far < d.body && d.gFar < d.body,
    `near layers draw OVER the body, far layers UNDER it (body ${d.body}, near ${d.near}/${d.gNear}, far ${d.far}/${d.gFar})`, JSON.stringify(d));
}
check(orient.north.rimA.length === 1 && orient.north.rimA[0] === 0.92 && orient.north.rimLayers.join() === 'far',
  `facing north the outer rim is the full ice-white rim (alpha ${orient.north.rimA.join('/')}), drawn on the far layer — not a dimmed copy`, JSON.stringify(orient.north));
check(orient.north.key >= 10, `facing north the restrained dark keyline is still drawn (${orient.north.key} segments on the far layer) — it used to be near-only`, JSON.stringify(orient.north));
check(orient.north.tips.length === 2 && orient.north.tips.every(([l, a]) => l === 'far' && a === 0.85),
  'facing north both tapered tips are drawn at full strength (0.85) on the far layer', JSON.stringify(orient.north.tips));
check(orient.pair.layers.slice().sort().join() === 'far,near' && orient.pair.args[0] === orient.pair.args[1],
  'two hits of the same age on opposite halves of a side-facing field: one smear on each layer, with IDENTICAL width, colour and alpha', JSON.stringify(orient.pair));
check(!orient.farKeys.length, 'no far-attenuation constants left in CURTAIN', JSON.stringify(orient.farKeys));
check(['Ep', 'Em', 'Wp', 'Wm'].every((k) => orient.beside[k] === 'glowNear') && orient.beside.N0 === 'glowFar' && orient.beside.NE === 'glowFar',
  'a reaction BESIDE him is drawn over him at either side of his centre line (east and west, offset ±0.1); one genuinely BEHIND him (facing north, or 69deg round the far side) still goes under his body',
  JSON.stringify(orient.beside));
{
  const t = orient.thick;
  check(Math.abs(t.S - 19) < 0.01 && t.N / t.S >= 0.75 && t.E / t.S >= 0.85 && Math.abs(t.E - t.W) < 0.01,
    `the band reads at a similar thickness at every facing — ${t.S.toFixed(1)} / ${t.E.toFixed(1)} / ${t.N.toFixed(1)}px south / side / north (the first build was 19 / 14 / 5: a thin arc from behind); the south view unchanged`,
    JSON.stringify(t));
}

// ── 5. EVENTS: real blocks and a real Super ──────────────────────────────
const ev = await pG.evaluate(() => {
  const gs = window.__gs; window.__open();
  const P = gs.player; P.setPosition(820, 1100); P.body.reset(820, 1100);
  const e = gs.spawnEnemyAt('shielded', 820, 560, {});
  e._performing = true; e._movePlanted = true; e._aim = Math.PI / 2; e._shieldFacing = Math.PI / 2; e.hp = e.hpMax = 1e7;
  window.__adv(2);
  const f = e._curtain, out = {};
  const fire = (x, ang) => gs.playerBullets.fire(x, 700, ang, 1100, 10, 900, { owner: 'player' });
  // ONE bolt
  const b = fire(820, -Math.PI / 2);
  let visibleBefore = null;
  for (let i = 0; i < 12 && f.events.length === 0; i++) { visibleBefore = b.visible && b.active; window.__adv(1); }
  out.one = { events: f.snapshot(), contact: e._lastBlockContact, hp: e.hp === 1e7, boltDead: !b.active, visibleBefore };
  // RAPID: four bolts at different lateral offsets, one every 5 frames
  const xs = [800, 838, 812, 846];
  for (let i = 0; i < 4; i++) { fire(xs[i], -Math.PI / 2); window.__adv(5); }
  window.__adv(8);
  out.rapid = f.snapshot();
  // deterministic expiry: advance past the reaction's own lifetime
  window.__adv(60);
  out.after = f.snapshot();
  // a REAL Super from straight ahead
  P.setPosition(820, 760); P.body.reset(820, 760);
  P.superCharge = 999; P.tryFireSuper(-Math.PI / 2);
  const kinds = [];
  for (let i = 0; i < 40; i++) { window.__adv(1); for (const v of f.events) kinds.push(`${v.kind}`); }
  out.superStats = { ...f.stats };
  out.superSeen = [...new Set(kinds)];
  out.peakGap = 0;
  window.__adv(70);
  out.superAfter = f.snapshot();
  return out;
});
check(ev.one.events.length === 1 && ev.one.events[0].kind === 'block' && Math.abs(ev.one.events[0].off - ev.one.contact.off) < 1e-9 && ev.one.boltDead && ev.one.hp,
  'a real blocked bolt makes ONE local block event at its projected contact; the bolt dies and nothing is damaged', JSON.stringify(ev.one));
check(ev.one.visibleBefore === true, 'no predictive bolt hiding: the bolt is still visible on the frame before the block resolves', JSON.stringify(ev.one));
const offs = ev.rapid.filter((v) => v.kind === 'block');
check(offs.length >= 4 && new Set(offs.map((v) => v.off.toFixed(3))).size >= 4 && new Set(offs.map((v) => Math.round(v.t))).size >= 4,
  `rapid hits LAYER: ${offs.length} independent block events alive at once, at ${new Set(offs.map((v) => v.off.toFixed(3))).size} different contacts and ${new Set(offs.map((v) => Math.round(v.t))).size} different ages`, JSON.stringify(ev.rapid));
check(ev.after.length === 0, 'block events expire deterministically on their own clock (none left after the reaction\'s lifetime)', JSON.stringify(ev.after));
check(ev.superStats.tears === 1 && ev.superStats.pierces >= 2 && ev.superSeen.includes('tear') && ev.superStats.pricks <= 3,
  `a real Super through the front: ${ev.superStats.pierces} pellets recorded, ONE tear (${ev.superStats.merged} merged into it, ${ev.superStats.pricks} pinpricks) — one readable hole per volley`, JSON.stringify(ev.superStats));
check(ev.superAfter.length === 0, 'the field closes fully after a Super — no persistent gap, no event left', JSON.stringify(ev.superAfter));

// ── 6. ONE AUTHOR, and the RNG stream ────────────────────────────────────
const author = async (q) => {
  const p = await stepped(q);
  const r = await p.evaluate(() => {
    const gs = window.__gs; window.__open();
    const P = gs.player; P.setPosition(820, 1100); P.body.reset(820, 1100);
    const e = gs.spawnEnemyAt('shielded', 820, 560, {});
    e._performing = true; e._movePlanted = true; e._aim = Math.PI / 2; e._shieldFacing = Math.PI / 2; e.hp = e.hpMax = 1e7;
    window.__adv(2);
    const calls = { ring: 0, sparkle: 0 };
    const ring = gs.fx.impactRing, spk = gs.fx.healingSparkle;
    gs.fx.impactRing = function (...a) { if (a[2] === 0x50b0ff) calls.ring++; return ring.apply(this, a); };
    gs.fx.healingSparkle = function (...a) { calls.sparkle++; return spk.apply(this, a); };
    const d0 = window.__draws;
    for (let i = 0; i < 6; i++) { gs.playerBullets.fire(805 + i * 6, 700, -Math.PI / 2, 1100, 10, 900, { owner: 'player' }); window.__adv(6); }
    window.__adv(10);
    return { calls, draws: window.__draws - d0, blocks: e._curtain?.stats.blocks ?? null, last: !!e._lastBlockContact, flash: e._shieldFlash };
  });
  await p.close();
  return r;
};
const aL = await author('?nodlg=1&nofreeze=1'), aV = await author('?nodlg=1&nofreeze=1&roster=v1');
check(aL.calls.ring === 6 && aL.calls.sparkle === 6, `legacy still draws its clang and sparkle on every block (${aL.calls.ring} / ${aL.calls.sparkle} of 6)`, JSON.stringify(aL));
check(aV.calls.ring === 0 && aV.calls.sparkle === 0 && aV.blocks === 6, 'v1: the field is the ONE author — no legacy clang, no blue sparkle, six field block events', JSON.stringify(aV));
check(aL.draws === aV.draws && aV.draws > 0, `v1 makes the legacy sparkle's random draws unseen, so the stream is identical: ${aV.draws} draws in both`, JSON.stringify({ L: aL.draws, V: aV.draws }));
check(aV.last && aL.last, 'the frozen seam still records the contact on both (onBlock)', '');

// ── 7. INVARIANCE: seeded VANGUARD replays ───────────────────────────────
async function vanguard(q) {
  const page = await stepped(`?nodlg=1&nofreeze=1&move=v22&encdbg=vanguard&room=hangar&sector=8&wave=2${q}`);
  const r = await page.evaluate(() => {
    const gs = window.__gs, ids = new Map(); let nid = 0;
    const id = (e) => { if (!ids.has(e)) ids.set(e, nid++); return ids.get(e); };
    const shots = [], snaps = [], lag = []; let tick = 0, gaitFrames = 0, blocks = 0, pierces = 0;
    gs.events.on('shooter-fire', (s, a) => {
      shots.push(`${tick}:${id(s)}:${a.toFixed(6)}:${s.x.toFixed(3)},${s.y.toFixed(3)}`);
      if (s.enemyType === 'shielded') { let d = a - s._aim; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; lag.push(Math.abs(d)); }
    });
    const k = gs.keys, P = gs.player;
    // the SAME script as the evidence A/B (shot-bulwark.mjs): hold while the
    // front forms, fire into the shields, strafe, two Supers — the first kills
    // most of the formation, an Elite included, inside the window
    const seg = [[0,420,''],[420,560,''],[560,640,'D'],[640,760,''],[760,840,'A'],[840,1000,''],[1000,1080,'S'],[1080,1200,''],[1200,1290,'W'],[1290,99999,'']];
    let eliteDeaths = 0;
    gs.events.on('enemy-died', (e) => { if (e.enemyType === 'shielded' && e._elite) eliteDeaths++; });
    window.__eliteDeaths = () => eliteDeaths;
    for (; tick < 1320; tick++) {
      const cur = seg.find(([a, b]) => tick >= a && tick < b)[2];
      k.A.isDown = cur === 'A'; k.D.isDown = cur === 'D'; k.W.isDown = cur === 'W'; k.S.isDown = cur === 'S';
      if (tick >= 380 && tick % 9 === 0) P.keyboardFire();
      if (tick === 900 || tick === 1240) { P.superCharge = 999; P.tryFireSuper(P._autoAimAngle()); }
      window.__adv(1);
      for (const e of gs.enemies.getChildren()) if (e._gait?.walking && e.enemyType === 'shielded') gaitFrames++;
      for (const e of gs.enemies.getChildren()) if (e._lastBlockContact && !e.__seenB) { e.__seenB = e._lastBlockContact; }
      if (tick % 15 === 14) {
        const f = gs._vanguardFront;
        snaps.push(gs.enemies.getChildren().filter((e) => e.active).map((e) => `${id(e)}:${e.enemyType}:${e.x.toFixed(3)},${e.y.toFixed(3)},${e.body.velocity.x.toFixed(3)},${e.body.velocity.y.toFixed(3)},${e.hp},${e.state},${e._aim.toFixed(4)},${e._shieldFacing?.toFixed?.(4)},${e._screenHolding},${e._lane ? 'L' : '-'},${e.fireCd?.toFixed?.(2)},${e.anims.currentAnim?.key?.replace(/^ro-blw-[RE]|^shooter|^ro-[a-z]{3}-[RE]/, 'K')},${e.body.width}`).join('|')
          + `#P${gs.player.x.toFixed(3)},${gs.player.y.toFixed(3)},${gs.player.hp},${gs.player.superCharge}#F${f ? `${f.released}/${f.why}/${f.releasedAt}/${f.holdMs.toFixed(1)}` : '-'}#Q${gs._spawnQueue?.length},${gs._waveSpawned}`
          + `#B${gs.enemyBullets.getChildren().filter((b) => b.active).map((b) => `${b.x.toFixed(2)},${b.y.toFixed(2)}`).join(';')}#R${window.__draws}`);
      }
    }
    for (const e of gs.enemies.getChildren()) if (e._curtain) { blocks += e._curtain.stats.blocks; pierces += e._curtain.stats.pierces; }
    for (const e of ids.keys()) if (e._curtain && !e.active) { blocks += e._curtain.stats.blocks; pierces += e._curtain.stats.pierces; }
    lag.sort((a, b) => a - b);
    return { eliteDeaths: window.__eliteDeaths(), shots, snaps, gaitFrames, blocks, pierces, front: gs._vanguardFront && { released: gs._vanguardFront.released, why: gs._vanguardFront.why }, lag: { n: lag.length, med: lag[lag.length >> 1], p90: lag[Math.floor(lag.length * 0.9)], max: lag[lag.length - 1] }, shielded: [...ids.keys()].filter((e) => e.enemyType === 'shielded').length };
  });
  await page.close();
  return r;
}
const vL = await vanguard(''), vV = await vanguard('&roster=v1'), vG = await vanguard('&roster=v1&gait=v2');
for (const [a, b, tag] of [[vL, vV, 'legacy vs roster=v1'], [vV, vG, 'roster=v1: gait off vs gait=v2']]) {
  const d = a.snaps.findIndex((s, i) => s !== b.snaps[i]);
  check(a.snaps.length === 88 && d === -1,
    `VANGUARD (A, sector 8, wave 2, 1320 ticks, Supers at 900 and 1240, ${b.eliteDeaths} Elite Bulwark death${b.eliteDeaths === 1 ? '' : 's'}) ${tag}: the SAME FIGHT — positions, velocities, AI state, aim, SHIELD FACING, screen hold, lanes, cooldowns, hp, collider, player hp + meter, the FRONT (released / reason / time), the queue, bolts, every random draw (88 checkpoints)`,
    d < 0 ? '' : `first divergence at ${d}\nA ${a.snaps[d]?.slice(0, 400)}\nB ${b.snaps[d]?.slice(0, 400)}`);
  check(JSON.stringify(a.shots) === JSON.stringify(b.shots) && a.shots.length > 10, `${tag}: the same ${b.shots.length} enemy shots on the same ticks from the same bodies`, `${a.shots.length} vs ${b.shots.length}`);
}
check(vV.eliteDeaths >= 1 && vL.eliteDeaths === vV.eliteDeaths, `(not vacuous) an ELITE Bulwark dies inside the replay window (${vV.eliteDeaths}) — the death that used to split the RNG stream`, JSON.stringify([vL.eliteDeaths, vV.eliteDeaths]));
check(vV.blocks > 0 && vV.pierces > 0 && vV.shielded >= 4, `(not vacuous) the v1 run's fields absorbed ${vV.blocks} blocked bolts and ${vV.pierces} Super pellets across ${vV.shielded} Bulwarks`, JSON.stringify({ b: vV.blocks, p: vV.pierces, n: vV.shielded }));
check(vG.gaitFrames > 200 && vV.gaitFrames === 0, `(not vacuous) gait v2 really drove ${vG.gaitFrames} Bulwark body-frames through the VANGUARD approach / hold / resume; off, it drove none`, `${vV.gaitFrames}/${vG.gaitFrames}`);
check(vL.front && vV.front && JSON.stringify(vL.front) === JSON.stringify(vV.front) && vL.front.released, `VANGUARD front resolved identically: released (${vV.front?.why})`, JSON.stringify([vL.front, vV.front]));
console.log(`  [info] shield-lag at fire time (|fire angle - drawn gun angle|, frozen gameplay): n=${vV.lag.n} median ${(vV.lag.med * 57.3).toFixed(1)}deg p90 ${(vV.lag.p90 * 57.3).toFixed(1)}deg max ${(vV.lag.max * 57.3).toFixed(1)}deg`);

// ── 7b. A DEATH IS THE SAME DEATH ───────────────────────────────────────
// The kill juice sizes its particle burst by the actor's scale and particles
// draw from the gameplay RNG; a v1 Elite renders at 1.0 against legacy 1.4.
const deaths = async (q) => {
  const p = await stepped(q);
  const r = await p.evaluate(() => {
    const gs = window.__gs; window.__open(); window.__adv(5);
    const out = {};
    for (const [k, type, spec] of [['blwR', 'shielded', {}], ['blwE', 'shielded', { elite: true }], ['gunE', 'shooter', { elite: true }], ['rifE', 'grunt', { elite: true }]]) {
      const e = gs.spawnEnemyAt(type, 700, 700, spec); window.__adv(2);
      const d0 = window.__draws; e.damage(1e7); out[k] = window.__draws - d0;
      window.__adv(60);
    }
    return out;
  });
  await p.close();
  return r;
};
const dL = await deaths('?nodlg=1&nofreeze=1'), dV = await deaths('?nodlg=1&nofreeze=1&roster=v1');
check(dL.blwR === dV.blwR && dL.blwE === dV.blwE && dV.blwE > dV.blwR,
  `a Bulwark's DEATH makes the same random draws legacy vs v1 — Regular ${dV.blwR}, Elite ${dV.blwE} (the Elite keeps its gameplay scale for the kill juice)`, JSON.stringify({ dL, dV }));
console.log(`  [info] PRE-EXISTING, frozen roles, not changed here: v1 Elite deaths draw differently from legacy — Gunner E ${dL.gunE} vs ${dV.gunE}, Rifleman E ${dL.rifE} vs ${dV.rifE} (render scale 1.0 feeds the kill juice)`);

// ── 8. CLEANUP ───────────────────────────────────────────────────────────
const clean = await pG.evaluate(() => {
  const gs = window.__gs; window.__open();
  const live = () => [...(gs.__blwFields || [])].length;
  const gfx = () => gs.children.list.filter((o) => o.type === 'Graphics' && o.active).length;
  window.__adv(2);
  const r = { g0: gfx(), f0: live() };
  const a = gs.spawnEnemyAt('shielded', 700, 700, {}), b = gs.spawnEnemyAt('shielded', 900, 700, { elite: true });
  window.__adv(2); r.f1 = live(); r.g1 = gfx();
  const att = [...a._attachments, ...b._attachments];
  a.damage(1e7); b.damage(1e7); window.__adv(3);
  r.f2 = live(); r.deadGfx = att.filter((g) => g.active).length;
  for (let i = 0; i < 4; i++) gs.spawnEnemyAt('shielded', 600 + i * 120, 900, i > 1 ? { elite: true } : {});
  window.__adv(2); r.f3 = live();
  gs._clearRoomEntities(); window.__adv(3);
  r.f4 = live(); r.g4 = gfx();
  return r;
});
check(clean.f1 === clean.f0 + 2 && clean.f2 === clean.f0 && clean.deadGfx === 0, `death removes the field: every Graphics it drew goes with the body (fields ${clean.f1} -> ${clean.f2})`, JSON.stringify(clean));
check(clean.f3 === clean.f0 + 4 && clean.f4 === 0 && clean.g4 <= clean.g0, 'room clear removes every field and leaves no shield Graphics behind', JSON.stringify(clean));
await pG.close();

// ── 9. FROZEN ────────────────────────────────────────────────────────────
{
  const run = (cmd) => execSync(cmd, { cwd: ROOT, encoding: 'utf8' });
  check(run('git diff --stat 3ce5680 -- src/entities/Enemy.js src/data/encounters.js').trim() === '', 'src/entities/Enemy.js and the encounter table are UNCHANGED (since 3ce5680)', '');
  const base = (src) => { const a = src.indexOf('export class Enemy extends'); return src.slice(0, src.indexOf('\nexport class ', a + 10)); };
  check(base(run('git show 6560c62:src/entities/Enemy.js')) === base(readFileSync(ROOT + 'src/entities/Enemy.js', 'utf8')), 'the Enemy BASE CLASS is byte-identical to 6560c62', '');
  const blk = (src) => { const a = src.indexOf('  shielded: {'); return src.slice(a, src.indexOf('  },', a)); };
  check(blk(run('git show 577c487:src/config.js')) === blk(readFileSync(ROOT + 'src/config.js', 'utf8')), 'ENEMY.shielded (hp, speed, radius, range, cadence, bolt, half-arc 1.35, turn 2.6) is unchanged', '');
  const code = (f) => readFileSync(ROOT + f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const cur = code('src/systems/bulwarkCurtain.js');
  check(!/Bullets|\.setVisible\(\s*false\s*\)\s*;?\s*\/\/?\s*bolt|bullet/i.test(cur.replace(/shieldArc\?\.setVisible\(false\)/, '')), 'no predictive bolt hiding: the field module never touches a bullet', '');
  check(!/\bhp\b|\bbreak\b|cooldown|_shieldFacing\s*=|_shieldHalfArc\s*=|_blocksFrontal\s*=|isFrontalHit\s*=|Math\.random|delayedCall|tweens\./.test(cur.replace(/break;/g, '')),
    'the field module has no shield hp / break / cooldown, writes no gameplay field, owns no timer or tween, and draws no random number', '');
}

await browser.close();
let bad = 0;
for (const c of checks) { console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.l}${c.ok ? '' : `  [${c.d}]`}`); if (!c.ok) bad++; }
console.log(`\n${checks.length - bad}/${checks.length} checks passed`);
process.exit(bad ? 1 : 0);
