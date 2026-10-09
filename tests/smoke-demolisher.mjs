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
//   - THE SIDE RUN (Phase 2D correction): one pelvis both legs leave from
//     under, both boots toe-capped and pointing east (west = the same frames
//     mirrored, live), a compact stride, no backward knee, a continuous
//     six-phase loop within the unchanged 80px / 32fps cadence contract, and
//     every front/back frame and every profile frame above the pelvis
//     pixel-identical to 785999f;
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
//   - THE FIRST STUCK CHECK (Phase 2D correction): a fresh Demolisher in a
//     clear lane arms no sidestep (legacy, v1, Regular, Elite, six at once),
//     a REAL obstruction is still recovered from on the base's next check,
//     the nemesis never sees the veto, and the replay with the veto switched
//     off is the pre-correction game at all 72 checkpoints (DEM_OLD) and
//     differs from this build only from the first vetoed check;
//   - FROZEN: Enemy.js unchanged since 3ce5680 except the authorized
//     EnemyBomber veto (tests/enemy-frozen.mjs), the encounter table and
//     ENEMY.bomber unchanged, the other roles' art keys and gait cycles
//     unchanged.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { enemyJsGuard } from './enemy-frozen.mjs';
import { veerRun, veerSummary } from './diag-demolisher-veer.mjs';

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

// ── 2b. THE SIDE RUN (Phase 2D correction) ───────────────────────────────
// Handset review of 785999f rejected the profile run: the hip socket sat
// behind his centre, so the trailing leg hung off his back under the rear
// canister; a +5/-5 split on five-row legs; a trailing boot that read as
// reversed. Measured from the PAINTED PIXELS of every side frame (idle, the
// six run frames, the brace, the three pose hooks, the six strafe frames):
const sideRun = async (page) => page.evaluate(async () => {
  const gs = window.__gs, rp = await window.__mod(/systems\/rosterPaint\.js/);
  const N = 0xa8541d, F = 0x6e3415, KNEE = 0xf4a55a, PELVIS = 0x1d1e23, BOOT = new Set([0x17181d, 0x2b2c33]), CAP = new Set([0x4b4c53, 0x303137]);
  const read = (key) => {
    const src = gs.textures.get(key).getSourceImage();
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    const x = c.getContext('2d'); x.drawImage(src, 0, 0);
    return { w: src.width, d: x.getImageData(0, 0, src.width, src.height).data };
  };
  const at = (S, f, lx, ly) => { const o = ((ly * 4 + 2) * S.w + f * 96 + lx * 4 + 2) * 4; return S.d[o + 3] ? (S.d[o] << 16) | (S.d[o + 1] << 8) | S.d[o + 2] : null; };
  const fnv = (h, v) => { for (let k = 0; k < 4; k++) { h ^= (v >>> (k * 8)) & 255; h = Math.imul(h, 16777619) >>> 0; } return h; };
  const SIDE = [16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, ...[0, 1, 2, 3, 4, 5].map((k) => rp.GAIT_STRAFE_BASE + 12 + k)];
  const out = {};
  for (const tier of ['R', 'E']) {
    const key = `ro-dem-${tier}`, B = read(key), H = read(`${key}-heat`);
    const n = gs.textures.get(key).getFrameNames().filter((x) => x !== '__BASE').length;
    // everything that is NOT a profile frame, and the profile frames ABOVE the
    // pelvis (rows 0-16: torso, helmet, canisters, rack, plate), body + heat
    let hNon = 2166136261, hUp = 2166136261;
    for (let f = 0; f < n; f++) {
      const side = SIDE.includes(f);
      for (let y = 0; y < (side ? 17 : 26); y++) for (let x = 0; x < 24; x++) {
        const v = ((at(B, f, x, y) ?? 0x1000000) ^ ((at(H, f, x, y) ?? 0x2000000) * 3)) >>> 0;
        if (side) hUp = fnv(hUp, v); else hNon = fnv(hNon, v);
      }
    }
    const fr = SIDE.map((f) => {
      // the pelvis band: the lowest row carrying pelvis/webbing pixels under the body
      let rp0 = -1; for (let y = 15; y < 22; y++) for (let x = 6; x < 18; x++) if (at(B, f, x, y) === PELVIS) rp0 = y;
      const pel = []; for (let x = 0; x < 24; x++) if (at(B, f, x, rp0) === PELVIS) pel.push(x);
      const root = []; for (let x = 0; x < 24; x++) { const c = at(B, f, x, rp0 + 1); if (c === N || c === F || c === KNEE) root.push(x); }
      // boots: connected boot + toe-cap pixels on the deck rows
      const bootPx = [], caps = [];
      for (let y = rp0 + 1; y < 26; y++) for (let x = 0; x < 24; x++) {
        const c = at(B, f, x, y);
        if (BOOT.has(c)) bootPx.push([x, y]);
        else if (CAP.has(c)) caps.push([x, y]);
      }
      const isBoot = (x, y) => BOOT.has(at(B, f, x, y));
      // a toe-cap closes a heel-to-toe run: boot to its WEST (a cap with nothing
      // of a boot behind it would be a toe pointing the other way)
      const capsEast = caps.filter(([x, y]) => isBoot(x - 1, y)).length;
      // the boots as separate objects (4-connected boot + cap pixels): where the
      // two feet are apart, EACH must carry its own toe-cap; where one stands in
      // front of the other the near boot may hide the far one's toe
      const all = new Map([...bootPx, ...caps].map(([x, y]) => [`${x},${y}`, [x, y]])), seen = new Set(), comps = [];
      for (const [k0, p0] of all) {
        if (seen.has(k0)) continue;
        const q = [p0], comp = []; seen.add(k0);
        while (q.length) { const [x, y] = q.pop(); comp.push([x, y]); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = `${x + dx},${y + dy}`; if (all.has(k) && !seen.has(k)) { seen.add(k); q.push(all.get(k)); } } }
        comps.push(comp.filter(([x, y]) => CAP.has(at(B, f, x, y))).length);
      }
      const xs = [...bootPx, ...caps].map(([x]) => x);
      let knee = 0; for (let y = rp0 + 1; y < 24; y++) for (let x = 0; x < 24; x++) if (at(B, f, x, y) === KNEE) knee++;
      return { f, rp0, pel: [Math.min(...pel), Math.max(...pel)], root, caps: caps.length, capsEast, comps, span: Math.max(...xs) - Math.min(...xs), west: Math.min(...xs), east: Math.max(...xs), knee };
    });
    out[tier] = { hNon: hNon.toString(16), hUp: hUp.toString(16), fr };
  }
  out.side = rp.DEMO_GAIT.side; out.fb = rp.DEMO_GAIT.fb;
  return out;
}).catch(() => null);
const SR = SH ? await sideRun(pV) : null;
// 785999f, measured: the frames this correction must not touch (FNV-1a over
// body + heat logical pixels). The pre-correction build reproduces both.
const H785 = { R: { hNon: '57fad92b', hUp: 'd2cf96c0' }, E: { hNon: '92613eee', hUp: 'f4ce2023' } };
for (const t of SR ? ['R', 'E'] : []) {
  const s = SR[t], run = s.fr.filter((x) => x.f >= 17 && x.f <= 22);
  // the first leg row below the pelvis band: a thigh may extend back ONE
  // column in one row (toe-off) or drive its knee forward (the swing), but it
  // never starts two or three columns behind the pelvis
  const inPel = (x) => x.root.length && x.root.every((rx) => rx >= x.pel[0] - 1 && rx <= x.pel[1] + 2);
  check(s.fr.every(inPel),
    `ro-dem-${t} profile: ONE PELVIS — in every side frame both legs leave the pelvis band from UNDER it (785999f started the trailing thigh 2-3 columns behind it, off his back under the rear canister)`,
    JSON.stringify(s.fr.filter((x) => !inPel(x)).map((x) => [x.f, x.pel, x.root])));
  // every side frame: each visible toe-cap closes a heel-to-toe run. The run
  // (idle, six run frames, brace): wherever the two boots stand apart, EACH
  // carries its own. (The unchanged profile strafe hides the far toe behind
  // the near shin in one frame — occlusion, not a reversed boot.)
  const capOk = (x) => x.caps >= 1 && x.capsEast === x.caps;
  const apartOk = (x) => x.comps.length < 2 || x.comps.every((c) => c === 1);
  const runSet = s.fr.filter((x) => x.f >= 16 && x.f <= 23);
  check(s.fr.every(capOk) && runSet.every(apartOk),
    `ro-dem-${t} profile: BOTH BOOTS POINT EAST — every visible toe-cap closes a heel-to-toe run (toe east), and through idle, run and brace, wherever the two boots stand apart EACH carries its own (785999f: the trailing boot had none); WEST is the same frame mirrored`,
    JSON.stringify(s.fr.filter((x) => !capOk(x) || (x.f <= 23 && !apartOk(x))).map((x) => [x.f, x.caps, x.capsEast, x.comps])));
  check(run.every((x) => x.span <= 10),
    `ro-dem-${t} profile: a COMPACT stride — heel-to-toe across both boots never wider than 10 logical px in a run frame (785999f split them 13 wide)`, JSON.stringify(run.map((x) => [x.f, x.span])));
  check(run.every((x) => x.knee >= 1),
    `ro-dem-${t} profile: the near knee is drawn in every run frame (articulated leg, not a post)`, JSON.stringify(run.map((x) => [x.f, x.knee])));
  check(s.hNon === H785[t].hNon, `ro-dem-${t}: every FRONT and BACK frame (idle, run, brace, pose hooks, strafe) and its heat layer is pixel-identical to 785999f — the correction is profile-only`, `${s.hNon} vs ${H785[t].hNon}`);
  check(s.hUp === H785[t].hUp, `ro-dem-${t}: every profile frame ABOVE THE PELVIS (helmet, torso, canisters, rack, containment plate) and its heat layer is pixel-identical to 785999f — body, equipment and attachment unchanged`, `${s.hUp} vs ${H785[t].hUp}`);
}
if (SR) {
  // the table the painter draws from: the leg geometry the pixels above came from
  const W = SR.side.walk, legs = ['N', 'F'];
  const top = (st) => (st === 'S' ? 20 : (st === 'H' || st === 'L') ? 21 : 22);
  // a knee BEHIND the straight hip-ankle line bends backwards
  const back = [];
  W.forEach((sp, k) => legs.forEach((L) => {
    const g = sp[L], hip = 18 + sp.bob, t0 = top(g.st), kneeY = hip + Math.max(1, Math.floor((t0 - hip) / 2)) - (g.st === 'S' ? 1 : 0);
    const u = (kneeY - hip) / Math.max(1, t0 - hip);
    if (g.k < g.f * u - 1e-9) back.push([k + 1, L, g.k, g.f]);
  }));
  check(!back.length, 'profile run: no knee ever bends backwards (every knee on or ahead of its hip-ankle line)', JSON.stringify(back));
  const fs = W.flatMap((sp) => legs.map((L) => sp[L].f));
  check(Math.min(...fs) >= -3 && Math.max(...fs) <= 4,
    `profile run: no giant trailing extension — the feet stay within -3..+4 of the hip (785999f: -5..+5)`, JSON.stringify([Math.min(...fs), Math.max(...fs)]));
  // the loop: consecutive frames, including 6 -> 1, move each foot by at most 4 px
  const jump = []; W.forEach((sp, k) => legs.forEach((L) => { const nx = W[(k + 1) % 6][L]; if (Math.abs(nx.f - sp[L].f) > 4 || Math.abs(nx.k - sp[L].k) > 3) jump.push([k + 1, L]); }));
  check(!jump.length, 'profile run: a continuous loop — no foot or knee jumps between consecutive frames, the 6 -> 1 wrap included', JSON.stringify(jump));
  // six-phase doctrine: each leg is planted (F, or H toeing off) for three
  // frames and swings for three, in antiphase; and a planted foot only travels BACKWARD
  const planted = (g) => g.st === 'F' || g.st === 'H';
  const phaseOk = legs.every((L) => W.filter((sp) => planted(sp[L])).length === 3) && W.every((sp) => planted(sp.N) !== planted(sp.F));
  const travel = []; legs.forEach((L) => W.forEach((sp, k) => { const nx = W[(k + 1) % 6][L]; if (planted(sp[L]) && planted(nx)) travel.push(sp[L].f - nx.f); }));
  check(phaseOk && travel.every((d) => d > 0),
    'profile run: SIX PHASES in antiphase (contact, load, toe-off on one leg while the other swings low and reaches), and a planted foot only ever moves backward under him', JSON.stringify({ phaseOk, travel }));
  // CADENCE CONTRACT: the planted foot's travel per frame against the cycle's
  // own 80px / 6 frames (at sheet scale 4) — the foot holds the deck
  const per = (SH.cyc['ro-dem'] / 6) / 4, mean = travel.reduce((a, b) => a + b, 0) / travel.length;
  check(Math.abs(mean / per - 1) <= 0.1 && travel.every((d) => d / per >= 0.75 && d / per <= 1.25),
    `profile run: CADENCE CONTRACT — the planted foot travels ${travel.join('/')} logical px per frame against ${per.toFixed(2)} for the 80px cycle (mean within 10%, no frame outside 25%): no skate at the unchanged cycle and ceiling`, JSON.stringify({ travel, per }));
  check(JSON.stringify(SR.fb) === JSON.stringify(SH.gait.fb) && JSON.stringify(SR.side.idle) === '{"N":{"k":1,"f":2,"st":"F"},"F":{"k":-1,"f":-3,"st":"F"},"bob":0}',
    'the FRONT/BACK gait table and the profile idle table are the approved ones (the correction rebuilt the profile run only)', JSON.stringify(SR.side.idle));
}
// WEST IS THE SAME RUN MIRRORED, live: a v1 Demolisher running west plays the
// profile run frames under flipX, running east the same frames unflipped —
// and it turns, on the gait v2 clock, without leaving the run
// (its own page: a run on pV would advance that page's random stream before section 3 compares it with pL)
const pM = SH ? await stepped('?nodlg=1&nofreeze=1&roster=v1&gait=v2&move=v22') : null;
const MIR = SH ? await pM.evaluate(() => {
  const gs = window.__gs; window.__open();
  if (gs.arenaCfg) gs.arenaCfg = { ...gs.arenaCfg, speedMult: undefined };
  const P = gs.player; P.setPosition(200, 700); P.body.reset(200, 700);
  const e = gs.spawnEnemyAt('bomber', 1000, 700, {});
  const look = () => ({ f: +e.frame.name, flip: e.flipX, key: e.anims.currentAnim?.key, vx: Math.round(e.body.velocity.x) });
  // (sampled clear of the 600ms stuck checks, so this asks only about the mirror)
  const west = []; for (let i = 0; i < 31; i++) { window.__adv(1); if (i >= 12) west.push(look()); }
  P.setPosition(1560, 700); P.body.reset(1560, 700);
  const east = []; for (let i = 31; i < 96; i++) { window.__adv(1); if (i >= 80) east.push(look()); }
  gs._destroyEnemyFully(e);
  return { west, east };
}) : null;
await pM?.close();
check(MIR && MIR.west.every((x) => x.flip === true && x.vx < 0 && x.f >= 17 && x.f <= 22) && MIR.east.every((x) => x.flip === false && x.vx > 0 && x.f >= 17 && x.f <= 22)
  && new Set(MIR.west.map((x) => x.f)).size >= 4 && new Set(MIR.east.map((x) => x.f)).size >= 4,
  'WEST is EAST mirrored, live: running west the body plays the profile run frames under flipX (both boots point WEST), running east the same frames unflipped; it turns back into the run on the gait clock',
  JSON.stringify(MIR && { w: MIR.west.slice(0, 6), e: MIR.east.slice(0, 6) }));

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
  out.vetoSeen = e._stuckFirstSeen ?? null;
  return out;
});
const NL = await nemesis(await stepped('?nodlg=1&nofreeze=1')), NV = await nemesis(await stepped('?nodlg=1&nofreeze=1&roster=v1&gait=v2'));
check(NV.tex === NL.tex && NV.prefix === NL.prefix && !NV.payload && NV.tex !== 'ro-dem-R' && NV.tex !== 'ro-dem-E',
  `NEMESIS bomber under ?roster=v1 is the legacy nemesis: its own sheet (${NV.tex}), no payload hook`, JSON.stringify([NL.tex, NV.tex, NV.payload]));
check(NV.alive && NV.bursts >= 2 && NV.minGapMs >= 1700 && NV.tinted && NV.req === null,
  `NEMESIS survives contact: ${NV.bursts} survivable bursts in 7s, never closer than the frozen 1700ms cooldown (${NV.minGapMs}ms), still alive, its tint still written by its own tick`, JSON.stringify({ a: NV.alive, b: NV.bursts, g: NV.minGapMs, t: NV.tinted }));
check(JSON.stringify(NL.ticks) === JSON.stringify(NV.ticks) && NL.bursts === NV.bursts && NL.draws === NV.draws,
  'NEMESIS: the same fight with and without ?roster=v1 — position, hp, burst cooldown, tint, every random draw', `${JSON.stringify(NL.ticks.slice(0, 3))} vs ${JSON.stringify(NV.ticks.slice(0, 3))}`);
check(NL.vetoSeen === null && NV.vetoSeen === null, "NEMESIS: the Demolisher's false-first-stuck veto never runs on a nemesis bomber (its movement is the frozen nemesis's, first check included)", JSON.stringify([NL.vetoSeen, NV.vetoSeen]));

// ── 6. INVARIANCE: seeded BOMBER RUN replays ─────────────────────────────
async function bomberRun(q, { noVeto = false } = {}) {
  const page = await stepped(`?nodlg=1&nofreeze=1&move=v22&encdbg=bomberRun&room=hangar&sector=14&wave=1${q}`);
  const r = await page.evaluate(async (noVeto) => {
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
    // THE FALSE-FIRST-STUCK VETO, recorded: every first check it stood down
    // (`vetoes`). With `noVeto` the method only RECORDS what it would have
    // vetoed and leaves the sidestep armed — the counterfactual build, which
    // must be the pre-correction game exactly.
    const vetoes = [], EB = (await window.__mod(/entities\/Enemy\.js/))?.EnemyBomber;
    if (EB?.prototype._vetoFalseStuck) {
      const veto = EB.prototype._vetoFalseStuck;
      EB.prototype._vetoFalseStuck = function () {
        const first = !this._stuckFirstSeen && !this._miniBoss && this._stuckRefX !== undefined, armed = this._stuckSidestepMs > 0;
        const moved = first ? Math.hypot(this._stuckRefX - this._stuckOriginX, this._stuckRefY - this._stuckOriginY) : 0;
        if (noVeto) { if (first) { this._stuckFirstSeen = true; if (armed && moved >= 12) vetoes.push(`${tick}:${id(this)}:${moved.toFixed(1)}`); } return; }
        veto.call(this);
        if (first && armed && !(this._stuckSidestepMs > 0)) vetoes.push(`${tick}:${id(this)}:${moved.toFixed(1)}`);
      };
    }
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
    return { snaps, hurts, blasts, eliteDeaths, demDeaths, demFrames, vetoes, demolishers: [...ids.keys()].filter((e) => e.enemyType === 'bomber').length };
  }, noVeto);
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
// THE ONE PERMITTED DIVERGENCE. The same replay with the veto switched off
// (the counterfactual — the pre-correction game) must be the same fight up to
// the first first-check the veto stood down, and may differ only from there.
const bN = await bomberRun('', { noVeto: true }), bNV = await bomberRun('&roster=v1', { noVeto: true });
for (const [a, b, tag] of [[bN, bL, 'legacy'], [bNV, bV, '?roster=v1']]) {
  const d = a.snaps.findIndex((x, i) => x !== b.snaps[i]), v0 = +(b.vetoes[0] || '').split(':')[0];
  check(b.vetoes.length >= 1 && a.vetoes[0] === b.vetoes[0],
    `BOMBER RUN ${tag}: the veto really ran — ${b.vetoes.length} fresh Demolishers' first checks armed a sidestep after moving ${b.vetoes.map((x) => x.split(':')[2]).join(' / ')}px, and were stood down (the first at tick ${v0}); the counterfactual armed the same first one`, JSON.stringify({ veto: b.vetoes, cf: a.vetoes }));
  check(d === -1 || d * 15 + 14 >= v0,
    `BOMBER RUN ${tag}, veto vs NO veto: the SAME FIGHT until the first vetoed first check (tick ${v0}) — ${d < 0 ? 'and after it' : `first difference at checkpoint ${d} (tick ${d * 15 + 14})`}; nothing else in the fight moved`, d < 0 ? '' : `A ${a.snaps[d]?.slice(0, 300)}\nB ${b.snaps[d]?.slice(0, 300)}`);
  console.log(`  [replay ${tag}] veto: ${b.blasts.length} Demolisher deaths, ${b.hurts.length} hits on the player; counterfactual: ${a.blasts.length} deaths, ${a.hurts.length} hits; first divergence ${d < 0 ? 'none' : `checkpoint ${d}`}`);
}

// ── 6b. OLD vs NEW (DEM_OLD=<url of a pre-correction server: 785999f or cd4b0e9>)
// The same replay on the build before the Phase 2D correction must equal this
// build's COUNTERFACTUAL (the veto switched off) exactly — at all 72
// checkpoints, every detonation, every hit — which is what proves the veto is
// the ONLY gameplay change; and this build with the veto may differ from it
// only from the first first-check the veto stood down.
if (process.env.DEM_OLD) {
  const saved = BASE_OVERRIDE.v; BASE_OVERRIDE.v = process.env.DEM_OLD;
  const oL = await bomberRun(''), oV = await bomberRun('&roster=v1');
  BASE_OVERRIDE.v = saved;
  for (const [a, b, tag] of [[oL, bN, 'default (legacy)'], [oV, bNV, '?roster=v1']]) {
    const d = a.snaps.findIndex((x, i) => x !== b.snaps[i]);
    check(a.snaps.length === 72 && d === -1 && JSON.stringify(a.hurts) === JSON.stringify(b.hurts) && JSON.stringify(a.blasts) === JSON.stringify(b.blasts),
      `OLD vs NEW-WITHOUT-THE-VETO BOMBER RUN, ${tag}: the SAME FIGHT at all 72 checkpoints, the same detonations and the same damage to the player — the veto is the only gameplay change`, d < 0 ? '' : `first divergence at ${d}\nA ${a.snaps[d]?.slice(0, 400)}\nB ${b.snaps[d]?.slice(0, 400)}`);
  }
  for (const [a, b, tag] of [[oL, bL, 'default (legacy)'], [oV, bV, '?roster=v1']]) {
    const d = a.snaps.findIndex((x, i) => x !== b.snaps[i]), v0 = +(b.vetoes[0] || '').split(':')[0];
    check(d === -1 || d * 15 + 14 >= v0, `OLD vs NEW BOMBER RUN, ${tag}: identical until the first vetoed first check (tick ${v0}); first difference ${d < 0 ? 'none' : `at checkpoint ${d}`}`, d < 0 ? '' : `A ${a.snaps[d]?.slice(0, 300)}\nB ${b.snaps[d]?.slice(0, 300)}`);
  }
}

// ── 6c. THE FIRST STUCK CHECK (Phase 2D correction) ──────────────────────
// `Enemy.preUpdate` measures `hypot(x - (_stuckRefX ?? x))` every 600ms and the
// reference starts undefined, so its FIRST check always reads 0px and arms a
// 600ms perpendicular sidestep — on 785999f a fresh Demolisher in an empty
// lane veered ~90deg off its target 600ms after spawning, in legacy and v1.
// The veto re-measures that one check from where the window began; a REAL
// obstruction must still be recovered from on the base's own cadence.
{
  const lane = async (flags, elite, kase = 'clear', ticks = 110) => veerRun(browser, { base: BASE_OVERRIDE.v || BASE, flags, kase, elite, ticks });
  const runs = {
    'legacy Regular': await lane('', false), 'v1 Regular': await lane('roster=v1&gait=v2', false),
    'legacy Elite': await lane('', true), 'v1 Elite': await lane('roster=v1&gait=v2', true),
  };
  for (const [tag, r] of Object.entries(runs)) {
    const rows = r.rows.filter((x) => !x.dead), first = rows.findIndex((x) => x.refX != null), sm = veerSummary(r);
    const maxOff = Math.max(0, ...rows.filter((x) => x.off != null).map((x) => x.off));
    check(first >= 30 && rows[first].draws >= 1 && rows[first].fromSpawn >= 12 && !sm.first && sm.sideTicks === 0 && maxOff <= 3,
      `FRESH SPAWN, clear lane (${tag}): the first stuck check runs at ${rows[first]?.ms}ms, ${rows[first]?.fromSpawn}px from spawn, still draws its random number — and NO sidestep is armed; the body never leaves the bearing to the player by more than ${maxOff}deg (785999f: ~91deg for 600ms)`,
      JSON.stringify({ first: rows[first], armed: sm.first, sideTicks: sm.sideTicks, maxOff }));
  }
  const strip = (r) => JSON.stringify(r.rows.map(({ i, x, y, vx, vy, side, draws }) => [i, x, y, vx, vy, side, draws]));
  check(strip(runs['legacy Regular']) === strip(runs['v1 Regular']) && strip(runs['legacy Elite']) === strip(runs['v1 Elite']),
    'FRESH SPAWN: legacy and ?roster=v1 run the identical rush tick for tick — position, velocity, sidestep state, random draws (the fix is not a roster flag)', '');
  // a REAL obstruction: a wall square across the lane 140px out
  for (const [tag, flags] of [['legacy', ''], ['v1', 'roster=v1&gait=v2']]) {
    const r = await lane(flags, false, 'wall', 300), rows = r.rows.filter((x) => !x.dead);
    const first = rows.findIndex((x) => x.refX != null), ai = rows.findIndex((x) => x.side > 0), armed = rows[ai], pre = rows[ai - 1], sm = veerSummary(r);
    // pinned: in contact with the wall on the tick before, and less than the base's 12px over the window since the first check
    const pinned = armed && pre?.blocked && Math.hypot(pre.x - rows[first].x, pre.y - rows[first].y) < 12;
    check(first >= 0 && rows[first].side === 0 && armed && pinned && armed.ms > rows[first].ms && sm.sideTicks >= 20 && (!r.alive || rows.at(-1).y > 600),
      `REAL OBSTRUCTION (${tag}): stuck recovery still works — the first check (moved ${rows[first]?.fromSpawn}px in its window) is not a stall, the body then pins on the wall and the base's NEXT check arms the sidestep at ${armed?.ms}ms (${sm.sideTicks} ticks of sidestep), and it gets round: ${!r.alive ? 'detonated on the player' : `past the wall at y ${rows.at(-1).y}`}`,
      JSON.stringify({ first: rows[first], pre, armed, sideTicks: sm.sideTicks, alive: r.alive, last: rows.at(-1) }));
  }
  // MULTIPLE fresh Demolishers, staggered, Regular and Elite, from six bearings
  const multi = async (q) => {
    const page = await stepped(q);
    const out = await page.evaluate(() => {
      const gs = window.__gs; window.__open();
      if (gs.arenaCfg) gs.arenaCfg = { ...gs.arenaCfg, speedMult: undefined };
      const P = gs.player; P.setPosition(1000, 800); P.body.reset(1000, 800);
      const L = [];
      for (let i = 0; i < 132; i++) {
        if (i % 9 === 0 && L.length < 6) {
          const a = L.length * Math.PI / 3 + 0.3;
          L.push({ e: gs.spawnEnemyAt('bomber', 1000 + Math.cos(a) * 560, 800 + Math.sin(a) * 560, L.length % 3 === 2 ? { elite: true } : {}), born: i, first: null, armed: 0 });
        }
        window.__adv(1);
        for (const o of L) {
          if (!o.e.alive || i - o.born > 66) continue;
          if (o.first == null && o.e._stuckRefX !== undefined) o.first = i - o.born;
          if (o.e._stuckSidestepMs > 0) o.armed++;
        }
      }
      const r = L.map((o) => ({ first: o.first, armed: o.armed, elite: !!o.e._elite }));
      for (const o of L) if (o.e.active) gs._destroyEnemyFully(o.e);
      return r;
    });
    await page.close();
    return out;
  };
  for (const [tag, q] of [['legacy', '?nodlg=1&nofreeze=1'], ['v1', '?nodlg=1&nofreeze=1&roster=v1&gait=v2']]) {
    const M = await multi(q);
    check(M.length === 6 && M.every((m) => m.first != null && m.armed === 0) && M.filter((m) => m.elite).length === 2,
      `SIX fresh Demolishers (${tag}; four Regular, two Elite; spawned 150ms apart from six bearings): every one runs its first stuck check (${M.map((m) => m.first).join('/')} ticks after spawning) and NONE arms a sidestep in its first 1.1s`, JSON.stringify(M));
  }
}

// ── 7. FROZEN ────────────────────────────────────────────────────────────
{
  const run = (cmd) => execSync(cmd, { cwd: ROOT, encoding: 'utf8' });
  // NARROWED, not removed: Enemy.js was authorized ONE change since 3ce5680 —
  // the Demolisher's false-first-stuck veto (Phase 2D correction).
  const eg = enemyJsGuard(ROOT);
  check(eg.outside, 'src/entities/Enemy.js OUTSIDE class EnemyBomber is UNCHANGED since 3ce5680 (the base, Gunner, Rifleman, Bulwark, Marksman, Swarmling classes)', eg.detail);
  check(eg.bomberOnlyVeto && eg.vetoCode, 'EnemyBomber differs from 3ce5680 ONLY by the authorized false-first-stuck veto (two origin fields, one call, one pinned method)', eg.detail);
  check(run('git diff --stat 3ce5680 -- src/data/encounters.js').trim() === '', 'the encounter table is UNCHANGED (since 3ce5680)', '');
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
