// DEMOLISHER PRODUCTION (`bomber`, roster v1) — body + gait + the payload
// warning + the detonation hand-off. Presentation only.
//
// Pinned:
//   - UNITS: legacy is untouched (the grunt sheet under the hot tint); v1
//     wears ro-dem-R / ro-dem-E with every gameplay field identical — hp,
//     radius, speed, contact range, blast radius / damage / death scale, the
//     ELITE's historical collider at render scale 1 — and no firearm (the
//     inherited overlay stays hidden), no 2B firing cycle;
//   - SHEETS: 51 frames under ?gait=v2 (33 without), the 18 animation keys,
//     nothing empty or clipped, legs under the payload in every frame, the
//     payload RIGID on the torso (each walk frame's payload is the idle one
//     moved by the frame's own body offset), ONE off-centre indicator and no
//     lit row on the chest, the heat layer only ever over payload pixels and
//     their rim, Elite = same size, different hardware;
//   - WARNING: the v1 warning reads the frozen telegraph's OWN numbers (the
//     tint the AI asked for decodes to exactly t·flash), the body is never
//     tinted by it (ONE AUTHOR) while legacy still is, the hit flash still
//     works, the layers join in order as he closes and the lamp blinks faster
//     near than far (the frozen pulse rate);
//   - DETONATION: contact and death still run the frozen blast at the frozen
//     place, scale and damage; the payload (heat, lamps, bloom) and the body
//     and shadow are gone with it; room clear sweeps every payload;
//   - NEMESIS: a nemesis bomber under ?roster=v1 is the legacy nemesis — its
//     own sheet, no payload hook, its tint still written, a survivable contact
//     burst on the frozen cooldown — and the same as without the flag;
//   - INVARIANCE: seeded BOMBER RUN replays, legacy vs v1 and gait off vs v2,
//     are the SAME FIGHT: positions, velocities, hp, pulse, detonations,
//     damage to the player, every random draw — with Elite Demolishers dying
//     inside the window (their death juice draws the same);
//   - FROZEN: Enemy.js and the encounter table unchanged since 3ce5680,
//     ENEMY.bomber unchanged, the Bulwark's and the other roles' art keys and
//     gait cycles unchanged.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const BASE = process.env.DEM_BASE || 'http://localhost:5173/';
const BASE_OVERRIDE = { v: null };   // section 6b points one replay at another build
const ROOT = new URL('../', import.meta.url).pathname;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const checks = []; const check = (ok, l, d) => checks.push({ ok: !!ok, l, d });
const fail = (m) => { console.error('FAIL', m); process.exit(1); };

async function stepped(q, god = true) {
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  page.on('pageerror', (e) => fail(`${q}: ${e.message}`));
  await page.goto((BASE_OVERRIDE.v || BASE) + q);
  await page.waitForFunction(() => window.game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 45000 });
  await page.evaluate(async (god) => {
    const g = window.game; g.loop.sleep();
    let s = 12345; window.__draws = 0;
    Math.random = () => { window.__draws++; s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    window.__t = 1e5; Date.now = () => window.__t;
    window.__adv = (n = 1) => { for (let i = 0; i < n; i++) { window.__t += 1000 / 60; g.step(window.__t, 1000 / 60); } };
    g.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 4242 }); window.__adv(2);
    window.__mod = async (re) => { const u = performance.getEntriesByType('resource').map((r) => r.name).find((n) => re.test(n)); return u ? import(u) : null; };
    if (god) (await window.__mod(/systems\/debug\.js/)).setGodMode(true);
    window.__gs = g.scene.getScene('Game');
    for (let i = 0; i < 300 && !window.__gs.roomSpec; i++) window.__adv(1);
    window.__adv(20);
    window.__open = () => {
      const gs = window.__gs;
      gs.arenaActive = false; gs._roomModifier = null;
      for (const e of gs.enemies.getChildren().slice()) gs._destroyEnemyFully(e);
      for (const o of gs.roomLayer.getChildren()) if (o.body && (o.displayWidth || 0) < 1000) o.body.enable = false;
      for (const w of gs.walls?.getChildren?.() || []) if (w.body) w.body.enable = false;
    };
  }, god);
  return page;
}

// ── 1. UNITS ─────────────────────────────────────────────────────────────
const UNIT = () => {
  window.__unit = (type, spec = {}) => {
    const gs = window.__gs; window.__open();
    const e = gs.spawnEnemyAt(type, 700, 700, spec);
    e.body.updateFromGameObject?.();
    const r = {
      play: {
        hp: e.hp, hpMax: e.hpMax, radius: e.cfg.radius, speed: +e.cfg.speed.toFixed(4), contact: e.cfg.contactRange,
        blastR: e.cfg.blastRadius, blastD: e.cfg.blastDamage, deathScale: e.cfg.deathBlastScale,
        bodyW: e.body.width, bodyDx: +(e.body.center.x - e.x).toFixed(3), bodyDy: +(e.body.center.y - e.y).toFixed(3),
        elite: !!e._elite, rusher: e._isRusher, threat: e._threatScale || e._baseScale,
      },
      look: {
        tex: e.texture.key, prefix: e._animPrefix, scale: +e.scaleX.toFixed(4), baseScale: e._baseScale, tint: e.tintTopLeft, tinted: e.isTinted,
        weapon: e.weaponSprite?.texture?.key ?? null, weaponVis: e.weaponSprite?.visible ?? null, rosterFx: e._rosterFx || null,
        payload: !!e._payload, heatKey: e._payload?.heat?.texture?.key ?? null,
      },
    };
    gs._destroyEnemyFully(e);
    return r;
  };
};
const pL = await stepped('?nodlg=1&nofreeze=1');
await pL.evaluate(UNIT);
const L = await pL.evaluate(() => ({ R: window.__unit('bomber'), E: window.__unit('bomber', { elite: true }) }));
const pV = await stepped('?nodlg=1&nofreeze=1&roster=v1&gait=v2&move=v22');
await pV.evaluate(UNIT);
const V = await pV.evaluate(() => ({ R: window.__unit('bomber'), E: window.__unit('bomber', { elite: true }), swarm: window.__unit('swarmling') }));
for (const [k, tier, sfx] of [['R', 'Regular', 'R'], ['E', 'Elite', 'E']]) {
  const l = L[k], v = V[k];
  check(v.look.tex === `ro-dem-${sfx}` && v.look.prefix === `ro-dem-${sfx}` && v.look.payload && v.look.heatKey === `ro-dem-${sfx}-heat`,
    `Demolisher ${tier}: wears ro-dem-${sfx} (texture + animation prefix) with its payload warning on ro-dem-${sfx}-heat`, JSON.stringify(v.look));
  const { threat: _a, ...lp } = l.play, { threat: _b, ...vp } = v.play;
  check(JSON.stringify(lp) === JSON.stringify(vp),
    `Demolisher ${tier}: gameplay identical to legacy — hp ${v.play.hp}, speed ${v.play.speed}, radius ${v.play.radius}, body ${v.play.bodyW}px centred, contact ${v.play.contact}, blast ${v.play.blastR}px / ${v.play.blastD} (death x${v.play.deathScale}), rusher`,
    `${JSON.stringify(l.play)} vs ${JSON.stringify(v.play)}`);
  check(l.play.threat === v.play.threat, `Demolisher ${tier}: the kill juice reads the same threat scale (${v.play.threat}) — its death is the legacy death`, `${l.play.threat} vs ${v.play.threat}`);
  check(v.look.tint === 0xffffff && !v.look.tinted && v.look.scale === 1 && v.look.baseScale === 1,
    `Demolisher ${tier}: baked palette — no tint at all (no gold, no hot body), render scale 1`, JSON.stringify(v.look));
  check(v.look.weaponVis === false && !v.look.rosterFx && l.look.weaponVis === false,
    `Demolisher ${tier}: no firearm — the inherited overlay stays hidden and no firing cycle is attached`, JSON.stringify(v.look));
  check(l.look.tex === 'grunt' && l.look.tinted && !l.look.payload, `Demolisher ${tier}: legacy (no flag) still wears the grunt sheet under its tint, no payload hook`, JSON.stringify(l.look));
}
check(V.E.play.bodyW === L.E.play.bodyW && V.E.play.bodyW > V.R.play.bodyW, `Demolisher Elite: HISTORICAL collider (${V.E.play.bodyW}px) at render scale 1.0`, JSON.stringify([V.R.play.bodyW, V.E.play.bodyW]));
check(V.swarm.look.tex === 'grunt' && !V.swarm.look.payload, 'swarmlings (a bomber-family grunt subclass) stay on legacy art, no payload', JSON.stringify(V.swarm.look));

// ── 2. SHEETS ────────────────────────────────────────────────────────────
const sheet = async (page) => page.evaluate(async () => {
  const gs = window.__gs, rp = await window.__mod(/systems\/rosterPaint\.js/);
  const read = (key) => {
    const src = gs.textures.get(key).getSourceImage();
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    const x = c.getContext('2d'); x.drawImage(src, 0, 0);
    return { w: src.width, d: x.getImageData(0, 0, src.width, src.height).data };
  };
  // logical pixel colour of frame f at (lx, ly) (scale 4: sample the centre)
  const at = (S, f, lx, ly) => { const o = ((ly * 4 + 2) * S.w + f * 96 + lx * 4 + 2) * 4; return S.d[o + 3] ? (S.d[o] << 16) | (S.d[o + 1] << 8) | S.d[o + 2] : null; };
  const OUT = 0x06070a, RIM = 0xd8300c;
  const out = {};
  for (const tier of ['R', 'E']) {
    const key = `ro-dem-${tier}`, B = read(key), H = read(`${key}-heat`);
    const n = gs.textures.get(key).getFrameNames().filter((x) => x !== '__BASE').length;
    const nh = gs.textures.get(`${key}-heat`).getFrameNames().filter((x) => x !== '__BASE').length;
    const anims = ['idle', 'walk', 'fire', 'raise', 'thrust', 'recoil'].flatMap((a) => ['front', 'back', 'side'].map((d) => `${key}-${a}-${d}`)).filter((k) => gs.anims.exists(k)).length;
    const lamps = rp.DEMO_LAMPS[key];
    const fr = [];
    for (let f = 0; f < n; f++) {
      let op = 0, edge = 0, heatPx = 0, heatBad = 0, payLow = -1, bootTop = 99, minX = 99, maxX = -1, minY = 99, maxY = -1;
      const pay = [];
      for (let y = 0; y < 26; y++) for (let x = 0; x < 24; x++) {
        const c = at(B, f, x, y), h = at(H, f, x, y);
        if (c != null) {
          op++; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
          if (c !== OUT && (x === 0 || x === 23 || y === 0 || y === 25)) edge++;
          if (c === 0x17181d || c === 0x2b2c33) bootTop = Math.min(bootTop, y);
        }
        if (h != null) {
          heatPx++;
          if (h !== RIM) { pay.push([x, y]); payLow = Math.max(payLow, y); }
          // heat only over a payload pixel (any body colour but outline) or the outline rim
          if (c == null || (h === RIM) !== (c === OUT)) heatBad++;
        }
      }
      fr.push({ f, op, edge, heatPx, heatBad, payLow, bootTop, bbox: [minX, minY, maxX, maxY], pay, ind: lamps[f]?.ind || [], st: lamps[f]?.st || [] });
    }
    out[tier] = { n, nh, anims, fr };
  }
  out.gait = rp.DEMO_GAIT; out.cyc = rp.GAIT_CYCLE_PX; out.fps = rp.GAIT_MAX_FPS;
  return out;
});
const SH = await sheet(pV).catch((err) => null);   // null on a build with no Demolisher sheets (the A/B)
check(!!SH, 'the Demolisher sheets exist (ro-dem-R / ro-dem-E and their heat layers)', '');
for (const t of SH ? ['R', 'E'] : []) {
  const s = SH[t];
  check(s.n === 51 && s.nh === 51 && s.anims === 18, `ro-dem-${t}: 51 frames (33 stock + 18 strafe) and a 51-frame heat layer; all 18 animation keys`, JSON.stringify({ n: s.n, nh: s.nh, a: s.anims }));
  check(s.fr.every((x) => x.op > 150 && x.edge === 0), `ro-dem-${t}: no empty frame, nothing clipped at the canvas edge`, JSON.stringify(s.fr.filter((x) => !(x.op > 150 && x.edge === 0)).map((x) => [x.f, x.op, x.edge])));
  check(s.fr.every((x) => x.heatPx > 0 && x.heatBad === 0), `ro-dem-${t}: the payload heat lies ONLY on payload pixels and the payload's own rim, in every frame`, JSON.stringify(s.fr.filter((x) => x.heatBad).map((x) => [x.f, x.heatBad])));
  check(s.fr.every((x) => x.payLow < x.bootTop), `ro-dem-${t}: legs under the payload in every frame (lowest payload row above the boots)`, JSON.stringify(s.fr.filter((x) => !(x.payLow < x.bootTop)).map((x) => [x.f, x.payLow, x.bootTop])));
  // ONE off-centre indicator; no lit row across the chest
  const front = [0, 1, 2, 3, 4, 5, 6, 7].map((f) => s.fr[f]);
  check(front.every((x) => x.ind.length === 2 && x.ind.every(([lx]) => lx >= 13) && x.st.length === 4 && x.st.every(([, ly]) => ly <= 6)),
    `ro-dem-${t} front: ONE arming indicator, off-centre (char-left strap), and the only other lamps are on the canister caps above the shoulders — no lit row on the containment plate`, JSON.stringify(front.map((x) => [x.ind, x.st])));
  // the payload is RIGID: every walk frame's payload = the idle one moved by that frame's body offset
  const G = SH.gait; let rigid = 0, total = 0, worst = [];
  [['fb', 0], ['fb', 8], ['side', 16]].forEach(([tab, base]) => {
    const idle = new Set(s.fr[base].pay.map(([x, y]) => `${x},${y}`));
    G[tab].walk.forEach((sp, k) => {
      const ox = tab === 'side' ? 1 : (sp.dx || 0), oy = sp.bob;
      const moved = s.fr[base + 1 + k].pay;
      const hit = moved.filter(([x, y]) => idle.has(`${x - ox},${y - oy}`)).length;
      rigid += hit; total += moved.length;
      if (hit < moved.length * 0.97) worst.push([base + 1 + k, hit, moved.length]);
    });
  });
  check(!worst.length && rigid / total > 0.98, `ro-dem-${t}: the payload is RIGID on the torso — every run frame's canisters and charges are the idle ones moved by the body's own offset (${(100 * rigid / total).toFixed(1)}% of ${total} px)`, JSON.stringify(worst));
}
if (SH) {
  const r = SH.R.fr, e = SH.E.fr;
  const sizeOk = [0, 8, 16].every((f) => Math.abs((r[f].bbox[2] - r[f].bbox[0]) - (e[f].bbox[2] - e[f].bbox[0])) <= 1 && Math.abs(r[f].bbox[3] - e[f].bbox[3]) === 0 && r[f].bbox[1] - e[f].bbox[1] <= 1);
  check(sizeOk, 'Elite Demolisher: the SAME size as the Regular (bounding box within one logical pixel: a valve stub, never a bigger body)', JSON.stringify([0, 8, 16].map((f) => [r[f].bbox, e[f].bbox])));
}
check(SH && SH.cyc['ro-dem'] === 80 && SH.fps['ro-dem'] === 32 && SH.cyc['ro-gun'] === 48 && SH.cyc['ro-rif'] === 48 && SH.cyc['ro-mrk'] === 44 && SH.cyc['ro-blw'] === 40 && Object.keys(SH.fps).join() === 'ro-dem',
  'gait: the Demolisher runs an 80px cycle under a 32fps ceiling (a 300px/s body); every other role keeps its approved cycle and the 24fps ceiling', JSON.stringify({ c: SH?.cyc, f: SH?.fps }));

// ── 3. THE WARNING ───────────────────────────────────────────────────────
// A real rush: the AI ticks, the body closes on a still player from 420px.
const rush = async (page) => page.evaluate(() => {
  const gs = window.__gs; window.__open();
  const P = gs.player; P.setPosition(700, 1000); P.body.reset(700, 1000);
  const e = gs.spawnEnemyAt('bomber', 700, 580, {});
  const rows = []; let detonated = -1;
  const blast = e._blast.bind(e); e._blast = (s, m) => { detonated = rows.length; return blast(s, m); };
  for (let i = 0; i < 120 && e.alive; i++) {
    window.__adv(1);
    if (!e.alive) break;
    const p = e._payload;
    rows.push({ d: Math.hypot(P.x - e.x, P.y - e.y), req: e._legacyWarnTint ?? null, tint: e.tintTopLeft, tinted: e.isTinted, pulse: e._bombPulse,
      t: p ? p.t : null, flash: p ? p.flash : null, w: p ? p.w : null, frame: e.frame.name, heatVis: p ? p.heat.visible : null });
  }
  return { rows, detonated, alive: e.alive, visible: e.visible, shadowVis: e.shadow?.visible ?? null, att: e._attachments.map((a) => a.active) };
});
const RV = await rush(pV), RL = await rush(pL);
{
  // the tint the AI asked for decodes to EXACTLY t·flash (g = round(106 + 130·t·flash))
  const dec = RV.rows.filter((r) => r.req != null).map((r) => (r.t == null ? 1e9 : Math.abs((((r.req >> 8) & 255) - 106) - 130 * r.t * r.flash)));
  check(dec.length > 20 && Math.max(...dec) <= 0.5 + 1e-9,
    `WARNING reads the frozen telegraph's own numbers: on all ${dec.length} ticks the tint the AI asked for decodes to exactly the warning's t·flash (max error ${Math.max(...dec).toFixed(3)} of a colour step)`, '');
  check(RV.rows.every((r) => r.tint === 0xffffff && !r.tinted) && RV.rows.some((r) => r.req !== 0xff6a33 && r.req != null),
    'ONE AUTHOR: under v1 the AI still asks for its whole-body warning tint every tick, and the body is never tinted by it', JSON.stringify(RV.rows.slice(-3).map((r) => [r.req?.toString(16), r.tint.toString(16)])));
  check(RL.rows.every((r) => r.tinted) && RL.rows.at(-1).tint !== 0xff6a33, 'legacy (no flag) still paints the whole-body warning tint', JSON.stringify(RL.rows.slice(-2).map((r) => r.tint.toString(16))));
  // the same rush, the same numbers: timing and detonation tick
  check(RV.rows.length === RL.rows.length && RV.detonated === RL.detonated && RV.rows.every((r, i) => r.pulse === RL.rows[i].pulse && r.d === RL.rows[i].d),
    `the same rush on both builds: the same distance and pulse on every one of ${RV.rows.length} ticks, contact detonation on the same tick (${RV.detonated})`, `${RV.rows.length}/${RL.rows.length} det ${RV.detonated}/${RL.detonated}`);
  // the layers join in order as he closes
  const at = (lo, hi) => RV.rows.filter((r) => r.t >= lo && r.t < hi);
  const far = RV.rows.filter((r) => r.t === 0 && r.w), near = at(0.6, 1).filter((r) => r.w);
  check(far.length > 3 && far.every((r) => Math.abs(r.w.lamp - 0.55) < 1e-9 && Math.abs(r.w.status - 0.35) < 1e-9 && r.w.heat === 0 && !r.heatVis),
    `ARMED at range (${far.length} ticks beyond 300px): the indicator and the canister lights lit steady (no blink), the payload cold`, '');
  check(near.length >= 2 && near.every((r) => r.w.heat > 0.2 && r.heatVis) && Math.max(...near.map((r) => r.w.status)) > 0.6,
    `IMMINENT (t >= 0.6, inside 120px): the payload is HOT (heat ${near.map((r) => r.w.heat.toFixed(2)).join(', ')}) and the canister lights are on`, '');
  check(RV.rows.at(-1).t > 0.6 && RV.rows.at(-1).t <= 0.85, `the warning stays inside the frozen window: last live tick at t ${RV.rows.at(-1).t?.toFixed(3)} (contact at 48px is t 0.84 — nothing extends it)`, '');
  // the pulse quickens: the frozen pulse rate, per ms, far vs near
  const rate = (r0, r1) => (r1.pulse - r0.pulse) / (1000 / 60);
  const far2 = RV.rows.filter((r) => r.d >= 300);
  const rf = rate(far2[0], far2[1]), rn = rate(RV.rows.at(-2), RV.rows.at(-1));
  check(rn > 3 * rf, `the pulse quickens with proximity: ${rf.toFixed(4)} rad/ms far, ${rn.toFixed(4)} near (the frozen rate)`, '');
  check(RV.detonated >= 0 && !RV.alive && RV.visible === false && RV.shadowVis === false && RV.att.every((a) => !a),
    'CONTACT DETONATION: the frozen blast fires, and the payload (heat, lamps, bloom), the body and its shadow are gone with it', JSON.stringify(RV));
  check(RL.visible === true, 'legacy keeps its corpse fade (the hand-off change is v1 only)', '');
}
// the law itself
const law = await pV.evaluate(async () => { const m = await window.__mod(/systems\/demolisherPayload\.js/); if (!m) return null; return [0, 0.1, 0.2, 0.3, 0.45, 0.6, 0.75, 0.84].map((t) => ({ t, on: m.payloadWarning(t, 1), off: m.payloadWarning(t, 0) })); });
check(!!law && law.every((r, i) => i === 0 || (r.on.heat >= law[i - 1].on.heat && r.on.status >= law[i - 1].on.status)) && law[0].on.lamp === law[0].off.lamp && law[3].on.lamp - law[3].off.lamp > 0.95,
  'the warning law: heat and status only rise as he closes; at range the lamps are steady (armed), from ~255px the indicator blinks fully on the pulse', JSON.stringify(law?.map((r) => [r.t, +r.on.heat.toFixed(2), +r.on.status.toFixed(2), +r.on.lamp.toFixed(2), +r.off.lamp.toFixed(2)])));

// the hit flash still lands on the v1 body (and is not left behind)
const flash = await pV.evaluate(() => {
  const gs = window.__gs; window.__open();
  const P = gs.player; P.setPosition(700, 1100); P.body.reset(700, 1100);
  const e = gs.spawnEnemyAt('bomber', 700, 650, {}); window.__adv(2);
  gs.fx.hitFlash(e); window.__adv(1);
  const during = { fill: e.tintFill, c: e.tintTopLeft };
  window.__adv(12);
  return { during, after: { fill: e.tintFill, c: e.tintTopLeft, tinted: e.isTinted } };
});
check(flash.during.fill && flash.during.c === 0xffffff && !flash.after.fill && !flash.after.tinted, 'the hit flash still whitens the v1 body for its 80ms and clears to the baked art', JSON.stringify(flash));

// ── 4. DEATH + CLEANUP ───────────────────────────────────────────────────
const clean = await pV.evaluate(() => {
  const gs = window.__gs; window.__open();
  const P = gs.player; P.setPosition(300, 1300); P.body.reset(300, 1300);
  const live = () => gs.__demPayloads?.size ?? -1;
  const gfx = () => gs.children.list.filter((o) => o.type === 'Graphics' && o.active).length;
  window.__adv(2);
  const r = { p0: live(), g0: gfx() };
  const blasts = [];
  const a = gs.spawnEnemyAt('bomber', 900, 600, {}), b = gs.spawnEnemyAt('bomber', 1100, 600, { elite: true });
  for (const e of [a, b]) { const f = e._blast.bind(e); e._blast = (s, m) => { blasts.push([e._elite ? 'E' : 'R', s, m]); return f(s, m); }; }
  window.__adv(2); r.p1 = live();
  const att = [...a._attachments, ...b._attachments];
  a.damage(1e7); b.damage(1e7); window.__adv(1);
  r.blasts = blasts; r.vis = [a.visible, b.visible, a.shadow?.visible, b.shadow?.visible];
  window.__adv(3);
  r.p2 = live(); r.deadAtt = att.filter((g) => g.active).length;
  for (let i = 0; i < 4; i++) gs.spawnEnemyAt('bomber', 600 + i * 140, 900, i > 1 ? { elite: true } : {});
  window.__adv(2); r.p3 = live();
  gs._clearRoomEntities(); window.__adv(3);
  r.p4 = live(); r.g4 = gfx();
  r.left = gs.children.list.filter((o) => o.active && /^ro-dem-/.test(o.texture?.key || '')).length;
  return r;
});
check(JSON.stringify(clean.blasts) === JSON.stringify([['R', 2, 0.8], ['E', 2, 0.8]]), 'DEATH DETONATION: shot down, Regular and Elite each run the frozen death blast once (scale 2.0, x0.8 damage)', JSON.stringify(clean.blasts));
check(clean.p1 === clean.p0 + 2 && clean.p2 === clean.p0 && clean.deadAtt === 0 && clean.vis.every((v) => v === false),
  `death takes the payload with the blast: heat, lamps and bloom destroyed, body and shadow not left sliding through the explosion (payloads ${clean.p1} -> ${clean.p2})`, JSON.stringify(clean));
check(clean.p3 === clean.p0 + 4 && clean.p4 === 0 && clean.g4 <= clean.g0 && clean.left === 0, 'room clear removes every payload and leaves no Demolisher overlay behind', JSON.stringify(clean));

// ── 5. NEMESIS ───────────────────────────────────────────────────────────
const nemesis = async (page) => page.evaluate(async () => {
  const gs = window.__gs; window.__open();
  const nm = await window.__mod(/data\/nemesis\.js/);
  const P = gs.player; P.setPosition(700, 1100); P.body.reset(700, 1100);
  const nem = nm.rollNemesis(8, { base: 'bomber', traits: [] });
  gs._spawnMiniBoss(nem);
  const e = gs.enemies.getChildren().find((x) => x._miniBoss);
  e.setPosition(700, 900); e.body.reset(700, 900);
  const out = { tex: e.texture.key, prefix: e._animPrefix, payload: !!e._payload, hp0: e.hp, ticks: [] };
  let bursts = 0; const cb = e._contactBurst.bind(e); e._contactBurst = (p) => { if (e._burstCd <= 0) bursts++; return cb(p); };
  let lastBurst = -1, minGap = 1e9;
  e._contactBurst = ((f) => (p) => { if (e._burstCd <= 0) { if (lastBurst >= 0) minGap = Math.min(minGap, out.i - lastBurst); lastBurst = out.i; } return f(p); })(e._contactBurst);
  for (let i = 0; i < 420; i++) {
    out.i = i;
    window.__adv(1);
    if (i % 10 === 0) out.ticks.push([+e.x.toFixed(2), +e.y.toFixed(2), e.hp, +e._burstCd.toFixed(1), e.tintTopLeft, e.alive]);
  }
  out.minGapMs = Math.round(minGap * 1000 / 60);
  out.alive = e.alive; out.bursts = bursts; out.hp1 = e.hp; out.tinted = e.isTinted; out.req = e._legacyWarnTint ?? null;
  out.draws = window.__draws;
  return out;
});
const NL = await nemesis(await stepped('?nodlg=1&nofreeze=1')), NV = await nemesis(await stepped('?nodlg=1&nofreeze=1&roster=v1&gait=v2'));
check(NV.tex === NL.tex && NV.prefix === NL.prefix && !NV.payload && NV.tex !== 'ro-dem-R' && NV.tex !== 'ro-dem-E',
  `NEMESIS bomber under ?roster=v1 is the legacy nemesis: its own sheet (${NV.tex}), no payload hook`, JSON.stringify([NL.tex, NV.tex, NV.payload]));
check(NV.alive && NV.bursts >= 2 && NV.minGapMs >= 1700 && NV.tinted && NV.req === null,
  `NEMESIS survives contact: ${NV.bursts} survivable bursts in 7s, never closer than the frozen 1700ms cooldown (${NV.minGapMs}ms), still alive, its tint still written by its own tick`, JSON.stringify({ a: NV.alive, b: NV.bursts, g: NV.minGapMs, t: NV.tinted }));
check(JSON.stringify(NL.ticks) === JSON.stringify(NV.ticks) && NL.bursts === NV.bursts && NL.draws === NV.draws,
  'NEMESIS: the same fight with and without ?roster=v1 — position, hp, burst cooldown, tint, every random draw', `${JSON.stringify(NL.ticks.slice(0, 3))} vs ${JSON.stringify(NV.ticks.slice(0, 3))}`);

// ── 6. INVARIANCE: seeded BOMBER RUN replays ─────────────────────────────
async function bomberRun(q) {
  const page = await stepped(`?nodlg=1&nofreeze=1&move=v22&encdbg=bomberRun&room=hangar&sector=14&wave=1${q}`);
  const r = await page.evaluate(() => {
    const gs = window.__gs, ids = new Map(); let nid = 0;
    const id = (e) => { if (!ids.has(e)) ids.set(e, nid++); return ids.get(e); };
    const snaps = [], hurts = [], blasts = []; let tick = 0, eliteDeaths = 0, demDeaths = 0, demFrames = 0;
    // EQUALIZER, rig-only: the FROZEN roles' v1 Elites (Gunner / Rifleman /
    // Marksman) die with a smaller kill juice than legacy and so fewer random
    // draws — a pre-existing leak HANDOVER §0 flags and leaves to the human.
    // Unequalized, this replay splits on the first Elite Rifleman death
    // (checkpoint 68: 8490 vs 8470 draws). Those three roles' Elites get their
    // gameplay scale as `_threatScale` in BOTH builds (a no-op on legacy, where
    // it equals `_baseScale`). NEVER the Demolisher: its own `_threatScale` is
    // what is under test (A/B: without it this replay diverges).
    const mk = gs._makeElite.bind(gs);
    gs._makeElite = (en, o = {}) => { const r = mk(en, o); if (['grunt', 'shooter', 'sniper'].includes(en.enemyType)) en._threatScale ||= (o.scale ?? 1.4); return r; };
    const P = gs.player, k = gs.keys;
    const hurt = P.damage.bind(P);
    P.damage = (a, ang) => { hurts.push(`${tick}:${(+a).toFixed(3)}:${(ang ?? 0).toFixed(4)}`); return hurt(a, ang); };
    gs.events.on('enemy-died', (e) => { if (e.enemyType === 'bomber') { demDeaths++; if (e._elite) eliteDeaths++; blasts.push(`${tick}:${id(e)}:${e.x.toFixed(2)},${e.y.toFixed(2)}:${e._detonated}`); } });
    const seg = [[0, 200, ''], [200, 300, 'A'], [300, 420, ''], [420, 520, 'D'], [520, 640, 'S'], [640, 760, ''], [760, 860, 'W'], [860, 99999, '']];
    for (; tick < 1080; tick++) {
      const cur = seg.find(([a, b]) => tick >= a && tick < b)[2];
      k.A.isDown = cur === 'A'; k.D.isDown = cur === 'D'; k.W.isDown = cur === 'W'; k.S.isDown = cur === 'S';
      if (tick >= 60 && tick % 7 === 0) P.keyboardFire();
      window.__adv(1);
      for (const e of gs.enemies.getChildren()) if (e.enemyType === 'bomber' && e._gait?.walking) demFrames++;
      if (tick % 15 === 14) {
        snaps.push(gs.enemies.getChildren().filter((e) => e.active).map((e) => `${id(e)}:${e.enemyType}:${e.x.toFixed(3)},${e.y.toFixed(3)},${e.body.velocity.x.toFixed(3)},${e.body.velocity.y.toFixed(3)},${e.hp},${e.alive},${e._aim?.toFixed?.(4)},${e._bombPulse?.toFixed?.(5)},${e._detonated},${e.body.width.toFixed(3)},${e.anims.currentAnim?.key?.replace(/^grunt|^shooter|^ro-[a-z]{3}-[RE]/, 'K')}`).join('|')
          + `#P${P.x.toFixed(3)},${P.y.toFixed(3)},${P.hp},${P.superCharge}#Q${gs._spawnQueue?.length},${gs._waveSpawned}#R${window.__draws}`);
      }
    }
    return { snaps, hurts, blasts, eliteDeaths, demDeaths, demFrames, demolishers: [...ids.keys()].filter((e) => e.enemyType === 'bomber').length };
  });
  await page.close();
  return r;
}
const bL = await bomberRun(''), bV = await bomberRun('&roster=v1'), bG = await bomberRun('&roster=v1&gait=v2');
for (const [a, b, tag] of [[bL, bV, 'legacy vs roster=v1'], [bV, bG, 'roster=v1: gait off vs gait=v2']]) {
  const d = a.snaps.findIndex((s, i) => s !== b.snaps[i]);
  check(a.snaps.length === 72 && d === -1,
    `BOMBER RUN (sector 14, wave 1, 1080 ticks, firing + strafing) ${tag}: the SAME FIGHT — positions, velocities, hp, aim, pulse, detonation state, collider, walk / idle state, player hp + meter, the queue, every random draw (72 checkpoints)`,
    d < 0 ? '' : `first divergence at ${d}\nA ${a.snaps[d]?.slice(0, 500)}\nB ${b.snaps[d]?.slice(0, 500)}`);
  check(JSON.stringify(a.hurts) === JSON.stringify(b.hurts) && JSON.stringify(a.blasts) === JSON.stringify(b.blasts),
    `${tag}: the same ${b.blasts.length} Demolisher deaths at the same ticks and places, and the same ${b.hurts.length} damage events to the player (amount + direction, same tick)`, `${a.hurts.length}/${b.hurts.length} ${a.blasts.length}/${b.blasts.length}`);
}
check(bV.demDeaths >= 4 && bV.eliteDeaths >= 1 && bV.hurts.length >= 1, `(not vacuous) ${bV.demDeaths} Demolishers detonate inside the window, ${bV.eliteDeaths} of them Elite, and the player takes ${bV.hurts.length} damage events`, JSON.stringify({ d: bV.demDeaths, e: bV.eliteDeaths, h: bV.hurts.length }));
check(bG.demFrames > 100 && bV.demFrames === 0, `(not vacuous) gait v2 really drove ${bG.demFrames} Demolisher body-frames through the rush; off, none`, `${bV.demFrames}/${bG.demFrames}`);

// ── 6b. OLD vs NEW (DEM_OLD=<url of a cd4b0e9 server>) ───────────────────
// The same replay on the build before this pass: its legacy run must equal
// this build's legacy run (the default game did not move), and its v1 run —
// where the bomber still wore legacy art — must equal this build's v1 run.
if (process.env.DEM_OLD) {
  const saved = BASE_OVERRIDE.v; BASE_OVERRIDE.v = process.env.DEM_OLD;
  const oL = await bomberRun(''), oV = await bomberRun('&roster=v1');
  BASE_OVERRIDE.v = saved;
  for (const [a, b, tag] of [[oL, bL, 'cd4b0e9 vs NEW, default (legacy)'], [oV, bV, 'cd4b0e9 vs NEW, ?roster=v1']]) {
    const d = a.snaps.findIndex((x, i) => x !== b.snaps[i]);
    check(a.snaps.length === 72 && d === -1 && JSON.stringify(a.hurts) === JSON.stringify(b.hurts) && JSON.stringify(a.blasts) === JSON.stringify(b.blasts),
      `OLD vs NEW BOMBER RUN, ${tag}: the SAME FIGHT at all 72 checkpoints, the same detonations and the same damage to the player`, d < 0 ? '' : `first divergence at ${d}\nA ${a.snaps[d]?.slice(0, 400)}\nB ${b.snaps[d]?.slice(0, 400)}`);
  }
}

// ── 7. FROZEN ────────────────────────────────────────────────────────────
{
  const run = (cmd) => execSync(cmd, { cwd: ROOT, encoding: 'utf8' });
  check(run('git diff --stat 3ce5680 -- src/entities/Enemy.js src/data/encounters.js').trim() === '', 'src/entities/Enemy.js and the encounter table are UNCHANGED (since 3ce5680)', '');
  const blk = (src) => { const a = src.indexOf('  bomber: {'); return src.slice(a, src.indexOf('  },', a)); };
  check(blk(run('git show cd4b0e9:src/config.js')) === blk(readFileSync(ROOT + 'src/config.js', 'utf8')), 'ENEMY.bomber (hp 200, speed 300, radius 20, contact 48, blast 155 / 240, death x0.8) is unchanged', '');
  const paint = readFileSync(ROOT + 'src/systems/rosterPaint.js', 'utf8'), old = run('git show cd4b0e9:src/systems/rosterPaint.js');
  const line = "export const GAIT_CYCLE_PX = { 'ro-gun': 48, 'ro-rif': 48, 'ro-mrk': 44, 'ro-blw': 40 };   // world px of travel per 6-frame walk cycle";
  const at = paint.indexOf('export const GAIT_CYCLE_PX'), block = paint.slice(at, paint.indexOf('\n\n', at));
  check(old.includes(line) && block.startsWith(line.replace(" 40 };", " 40, 'ro-dem': 80 };")) && paint.startsWith(old.replace(line, block).trimEnd()),
    "the four approved roles' painters (Gunner, Rifleman, Marksman, Bulwark) are byte-identical to cd4b0e9 — the gait tables only gain a 'ro-dem' entry, and the Demolisher is appended", '');
}

await browser.close();
const bad = checks.filter((c) => !c.ok);
for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.l}${c.ok ? '' : `\n        ${c.d}`}`);
console.log(`\nsmoke-demolisher: ${checks.length - bad.length}/${checks.length}`);
process.exit(bad.length ? 1 : 0);
